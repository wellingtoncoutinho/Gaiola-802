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
    // Brazil timezone (UTC-3)
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

    // Direct concise message requested by user (no external links)
    const messageText = `Olá, ${assigned.name}, hoje é dia de tirar o lixo da casa. Clique em 'Confirmar retirada' somente quando retirar o lixo.`;
    const buttonTitle = 'Confirmar retirada';
    const buttonId = `CONFIRM_TRASH_${dateKey}`;

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

      // If interactive failed, attempt plain text fallback
      if (!metaRes.ok) {
        console.warn('[Trash Cron] Interactive message failed, attempting text fallback...', metaResult);
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
              body: `${messageText}\n\n👉 Responda "Confirmar retirada" nesta conversa para registrar a conclusão.`,
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
        chores.trashRecords[dateKey] = {
          date: dateKey,
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
      date: dateKey,
      assigned: assigned.name,
      room: assigned.room,
      phone: cleanPhone || 'nao_cadastrado',
      metaResult,
    });
  } catch (err: any) {
    console.error('[Trash Reminder Cron Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
