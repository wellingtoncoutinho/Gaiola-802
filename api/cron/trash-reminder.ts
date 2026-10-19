import { getChoresFromBlob, saveChoresToBlob } from '../chores.ts';

function sendResponse(res: any, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

const TRASH_MAP: Record<number, { room: string; moradorId: string; name: string }> = {
  1: { room: 'Quarto 1', moradorId: 'thaciane', name: 'Thaciane' },
  2: { room: 'Quarto 2', moradorId: 'pedro', name: 'Pedro' },
  3: { room: 'Quarto 3', moradorId: 'yan', name: 'Yan' },
  4: { room: 'Quarto 4', moradorId: 'wellington', name: 'Wellington' },
  5: { room: 'Quarto 5', moradorId: 'fabio', name: 'Fabio' },
};

export default async function handler(req: any, res: any) {
  try {
    const today = new Date();
    // In Brazil timezone (UTC-3)
    const brazilTimeStr = today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const brazilDate = new Date(brazilTimeStr);

    const weekday = brazilDate.getDay();
    const y = brazilDate.getFullYear();
    const m = String(brazilDate.getMonth() + 1).padStart(2, '0');
    const d = String(brazilDate.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;

    if (weekday === 0 || weekday === 6) {
      return sendResponse(res, 200, {
        status: 'skipped',
        message: 'Hoje é fim de semana. Sem escala obrigatória de lixo.',
        date: dateKey,
      });
    }

    const assigned = TRASH_MAP[weekday];
    if (!assigned) {
      return sendResponse(res, 200, { status: 'skipped', message: 'Nenhum quarto escalado.' });
    }

    const chores = await getChoresFromBlob();
    const existing = chores.trashRecords[dateKey];

    if (existing?.confirmed) {
      return sendResponse(res, 200, {
        status: 'already_confirmed',
        message: `O lixo de hoje (${dateKey}) já foi confirmado por ${existing.confirmedBy || assigned.name}.`,
      });
    }

    const phone = chores.phones[assigned.moradorId] || '';
    let cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const baseUrl = process.env.APP_URL || 'https://gaiola-802.vercel.app';
    const confirmUrl = `${baseUrl}/?confirm_chore=lixo&date=${dateKey}&morador=${assigned.moradorId}`;

    const messageText = `🗑️ *Gaiola 802 - Escala do Lixo*

Olá *${assigned.name}* (${assigned.room})!
Hoje é o seu dia oficial de retirar o lixo da casa (10h).

• Amarrar os sacos da cozinha, área de serviço e banheiros
• Descer até a lixeira do prédio
• Repor sacos novos nas lixeiras

✅ *Confirme a retirada no link abaixo:*
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

    // Record notification dispatch attempt
    const now = new Date().toISOString();
    chores.trashRecords[dateKey] = {
      ...(chores.trashRecords[dateKey] || {}),
      date: dateKey,
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
      date: dateKey,
      morador: assigned.name,
      room: assigned.room,
      phone: cleanPhone || 'não configurado',
      sentViaMeta: sentSuccess,
      metaResponse: metaResult,
    });
  } catch (err: any) {
    console.error('[Cron Trash Reminder Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
