import { getChoresFromBlob, saveChoresToBlob } from '../chores.ts';

function sendResponse(res: any, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

const CLEANING_ROOMS = [
  { moradorId: 'thaciane', room: 'Quarto 1', name: 'Thaciane' },
  { moradorId: 'pedro', room: 'Quarto 2', name: 'Pedro' },
  { moradorId: 'yan', room: 'Quarto 3', name: 'Yan' },
  { moradorId: 'wellington', room: 'Quarto 4', name: 'Wellington' },
  { moradorId: 'fabio', room: 'Quarto 5', name: 'Fabio' },
];

function getISOWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export default async function handler(req: any, res: any) {
  try {
    const today = new Date();
    const brazilTimeStr = today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const brazilDate = new Date(brazilTimeStr);

    const weekday = brazilDate.getDay();
    // Only send on Friday (5)
    if (weekday !== 5) {
      return sendResponse(res, 200, {
        status: 'skipped',
        message: 'Lembrete de manutenção da limpeza é disparado nas sextas-feiras.',
        weekday,
      });
    }

    const weekNumber = getISOWeekNumber(brazilDate);
    const year = brazilDate.getFullYear();
    const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

    const chores = await getChoresFromBlob();
    const existing = chores.cleaningRecords[weekId];

    if (existing?.confirmed) {
      return sendResponse(res, 200, {
        status: 'already_confirmed',
        message: `A manutenção de limpeza da semana (${weekId}) já foi confirmada.`,
      });
    }

    const rotationIndex = Math.abs((weekNumber + (chores.rotationOffset || 0)) % CLEANING_ROOMS.length);
    const assigned = CLEANING_ROOMS[rotationIndex];

    const phone = chores.phones[assigned.moradorId] || '';
    let cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const baseUrl = process.env.APP_URL || 'https://gaiola-802.vercel.app';
    const confirmUrl = `${baseUrl}/?confirm_chore=limpeza&week=${weekId}&morador=${assigned.moradorId}`;

    const messageText = `🧹 *Gaiola 802 - Manutenção da Limpeza*

Olá *${assigned.name}* (${assigned.room})!
Hoje é sexta-feira e esta semana a responsabilidade da manutenção da limpeza do apê é sua!

Checklist rápido:
• Trocar e recolher panos de prato e toalhas de mão
• Checar se as bancadas e pia da cozinha estão limpas
• Verificar lixeiras e reposição de sacos
• Manutenção do chão das áreas comuns

✅ *Após concluir, confirme no link abaixo:*
${confirmUrl}`;

    const phoneNumberId =
      process.env.META_WA_PHONE_NUMBER_ID || chores.metaConfig?.phoneNumberId || '';
    const accessToken =
      process.env.META_WA_ACCESS_TOKEN || chores.metaConfig?.accessToken || '';

    let metaResult: any = null;
    let sentSuccess = false;

    if (phoneNumberId && accessToken && cleanPhone) {
      const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
      const metaRes = await fetch(metaApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: messageText,
          },
        }),
      });
      metaResult = await metaRes.json();
      sentSuccess = metaRes.ok && !metaResult.error;
    }

    const now = new Date().toISOString();
    chores.cleaningRecords[weekId] = {
      ...(chores.cleaningRecords[weekId] || {}),
      weekId,
      weekNumber,
      year,
      startDate: '',
      fridayDate: '',
      endDate: '',
      moradorId: assigned.moradorId,
      room: assigned.room,
      confirmed: false,
      whatsappSent: sentSuccess,
      whatsappSentAt: now,
    };
    chores.updatedAt = now;
    await saveChoresToBlob(chores);

    return sendResponse(res, 200, {
      status: 'dispatched',
      weekId,
      morador: assigned.name,
      room: assigned.room,
      phone: cleanPhone || 'não configurado',
      sentViaMeta: sentSuccess,
      metaResponse: metaResult,
    });
  } catch (err: any) {
    console.error('[Cron Cleaning Reminder Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
