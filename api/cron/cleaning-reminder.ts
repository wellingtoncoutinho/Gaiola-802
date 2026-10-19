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
  { moradorId: 'pedro', room: 'Quarto 1', name: 'Pedro' },
  { moradorId: 'yan', room: 'Quarto 2', name: 'Yan' },
  { moradorId: 'wellington', room: 'Quarto 3', name: 'Wellington' },
  { moradorId: 'fabio', room: 'Quarto 4 (Suíte)', name: 'Fabio' },
  { moradorId: 'thaciane', room: 'Quarto 5', name: 'Thaciane' },
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

    // Direct concise message requested by user (no external links)
    const messageText = `Olá, ${assigned.name}, hoje é sexta-feira e é dia da manutenção de limpeza do apartamento.

Checklist:
• Checar se as bancadas e as pias estão limpas
• Verificar lixeiras e reposição de sacos
• Manutenção do chão das áreas comuns`;

    const buttonTitle = 'Limpeza concluída';
    const buttonId = `CONFIRM_CLEANING_${weekId}`;

    const phoneNumberId =
      process.env.META_WA_PHONE_NUMBER_ID ||
      chores.metaConfig?.phoneNumberId ||
      '1261779623696198';
    const accessToken =
      process.env.META_WA_ACCESS_TOKEN || chores.metaConfig?.accessToken || '';

    let metaResult: any = null;
    let sentSuccess = false;

    if (phoneNumberId && accessToken && cleanPhone) {
      const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

      const interactivePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: messageText,
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: buttonId,
                  title: buttonTitle,
                },
              },
            ],
          },
        },
      };

      let metaRes = await fetch(metaApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interactivePayload),
      });

      metaResult = await metaRes.json();

      // Fallback 1: Try official template gaiola_aviso_limpeza
      if (!metaRes.ok) {
        const templatePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'gaiola_aviso_limpeza',
            language: { code: 'pt_BR' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: assigned.name }],
              },
            ],
          },
        };

        const templateRes = await fetch(metaApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templatePayload),
        });

        if (templateRes.ok) {
          metaRes = templateRes;
          metaResult = await templateRes.json();
        }
      }

      // Fallback 2: Plain text with reply instructions
      if (!metaRes.ok) {
        console.warn('[Cleaning Cron] Interactive/Template failed, attempting text fallback...', metaResult);
        const fallbackRes = await fetch(metaApiUrl, {
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
              body: `${messageText}\n\n👉 Responda "Limpeza concluída" nesta conversa para registrar a conclusão.`,
            },
          }),
        });
        if (fallbackRes.ok) {
          metaRes = fallbackRes;
          metaResult = await fallbackRes.json();
        }
      }

      sentSuccess = metaRes.ok && !metaResult.error;

      if (sentSuccess) {
        const now = new Date().toISOString();
        chores.cleaningRecords[weekId] = {
          weekId,
          weekNumber,
          year,
          startDate: '',
          fridayDate: '',
          endDate: '',
          moradorId: assigned.moradorId,
          room: assigned.room,
          confirmed: false,
          whatsappSent: true,
          whatsappSentAt: now,
        };
        chores.updatedAt = now;
        await saveChoresToBlob(chores);
      }
    }

    return sendResponse(res, 200, {
      status: sentSuccess ? 'sent' : 'scheduled_ready',
      weekId,
      assigned: assigned.name,
      room: assigned.room,
      phone: cleanPhone || 'nao_cadastrado',
      metaResult,
    });
  } catch (err: any) {
    console.error('[Cleaning Reminder Cron Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
