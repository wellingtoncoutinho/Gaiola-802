import { getChoresFromBlob, saveChoresToBlob } from '../chores.ts';

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'gaiola802_webhook_token';

function sendRawResponse(res: any, status: number, body: string, contentType = 'text/plain') {
  res.setHeader('Content-Type', contentType);
  if (typeof res.status === 'function' && typeof res.send === 'function') {
    return res.status(status).send(body);
  }
  res.statusCode = status;
  res.end(body);
}

function sendJsonResponse(res: any, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    if (typeof req.body === 'string') {
      try {
        return resolve(JSON.parse(req.body));
      } catch {
        return resolve({});
      }
    }

    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Sends a free session reply message back to the sender within the active 24h customer window.
 */
async function sendReplyMessage(phoneNumberId: string, accessToken: string, toPhone: string, text: string) {
  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { body: text },
      }),
    });
  } catch (err) {
    console.error('[WhatsApp Webhook Reply Error]:', err);
  }
}

const ROOMMATES_META = [
  { id: 'thaciane', name: 'Thaciane', room: 'Quarto 1', weekday: 1 },
  { id: 'pedro', name: 'Pedro', room: 'Quarto 2', weekday: 2 },
  { id: 'yan', name: 'Yan', room: 'Quarto 3', weekday: 3 },
  { id: 'wellington', name: 'Wellington', room: 'Quarto 4', weekday: 4 },
  { id: 'fabio', name: 'Fabio', room: 'Quarto 5', weekday: 5 },
];

function getBrazilDateString(d: Date = new Date()): string {
  const brazilStr = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const bDate = new Date(brazilStr);
  const y = bDate.getFullYear();
  const m = String(bDate.getMonth() + 1).padStart(2, '0');
  const day = String(bDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getISOWeekId(d: Date = new Date()): string {
  const brazilStr = d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const bDate = new Date(brazilStr);
  const target = new Date(bDate.valueOf());
  const dayNr = (bDate.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${bDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (typeof res.status === 'function') return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url, `https://${req.headers?.host || 'localhost'}`);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Meta Webhook] Verification successful!');
      return sendRawResponse(res, 200, challenge || '');
    }
    console.warn('[Meta Webhook] Verification failed token mismatch:', { mode, token, expected: VERIFY_TOKEN });
    return sendRawResponse(res, 403, 'Forbidden');
  }

  // 2. Incoming WhatsApp Message / Button Click (POST)
  if (req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);

      // Verify that this is an event from a WhatsApp Business Account
      if (body.object !== 'whatsapp_business_account') {
        return sendJsonResponse(res, 200, { status: 'ignored' });
      }

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      // If it's a delivery receipt, read receipt, etc., acknowledge and return
      if (!message) {
        return sendJsonResponse(res, 200, { status: 'no_message' });
      }

      const senderPhone = (message.from || '').replace(/[^\d]/g, '');
      const senderContactName = value.contacts?.[0]?.profile?.name || '';
      const phoneNumberId = value.metadata?.phone_number_id || process.env.META_WA_PHONE_NUMBER_ID || '1261779623696198';

      // Load chores from Vercel Blob
      const chores = await getChoresFromBlob();
      const accessToken = process.env.META_WA_ACCESS_TOKEN || chores.metaConfig?.accessToken || '';

      // Match sender to roommate
      let matchedMorador = ROOMMATES_META.find((m) => {
        const storedPhone = (chores.phones[m.id] || '').replace(/[^\d]/g, '');
        if (!storedPhone) return false;
        return senderPhone.endsWith(storedPhone.slice(-8)) || storedPhone.endsWith(senderPhone.slice(-8));
      });

      // Extract button reply ID or incoming text body
      let buttonId = '';
      let textBody = '';

      if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
        buttonId = message.interactive.button_reply?.id || '';
      } else if (message.type === 'text') {
        textBody = (message.text?.body || '').trim().toLowerCase();
      }

      console.log('[Meta Webhook Event Received]:', {
        senderPhone,
        senderContactName,
        buttonId,
        textBody,
        matchedMorador: matchedMorador?.name,
      });

      const todayDateKey = getBrazilDateString();
      const currentWeekId = getISOWeekId();
      let updated = false;

      // Check if button click or message confirms TRASH duty
      const isTrashConfirm =
        buttonId.startsWith('CONFIRM_TRASH_') ||
        buttonId === 'CONFIRM_TRASH' ||
        textBody.includes('confirmar retirada') ||
        textBody.includes('lixo retirado') ||
        textBody === 'lixo' ||
        textBody === 'retirei';

      // Check if button click or message confirms CLEANING duty
      const isCleaningConfirm =
        buttonId.startsWith('CONFIRM_CLEANING_') ||
        buttonId === 'CONFIRM_CLEANING' ||
        textBody.includes('limpeza concluída') ||
        textBody.includes('limpeza concluida') ||
        textBody.includes('manutenção concluída') ||
        textBody.includes('faxina concluída') ||
        textBody === 'limpei';

      if (isTrashConfirm) {
        let dateKey = todayDateKey;
        if (buttonId.startsWith('CONFIRM_TRASH_')) {
          const extracted = buttonId.replace('CONFIRM_TRASH_', '').trim();
          if (extracted && extracted.length === 10) dateKey = extracted;
        }

        const existing = chores.trashRecords[dateKey] || {
          date: dateKey,
          moradorId: matchedMorador?.id || '',
          room: matchedMorador?.room || '',
        };

        const now = new Date().toISOString();
        chores.trashRecords[dateKey] = {
          ...existing,
          confirmed: true,
          confirmedAt: now,
          confirmedBy: matchedMorador?.name || senderContactName || 'WhatsApp',
          whatsappSent: true,
        };
        chores.updatedAt = now;
        await saveChoresToBlob(chores);
        updated = true;

        // Instant Free Thank-You Acknowledgment Reply
        if (accessToken && senderPhone) {
          const thankYouText = `🎉 Que legal que você tirou o lixo! Confirmado com sucesso no sistema da Gaiola 802.`;
          await sendReplyMessage(phoneNumberId, accessToken, senderPhone, thankYouText);
        }
      } else if (isCleaningConfirm) {
        let weekId = currentWeekId;
        if (buttonId.startsWith('CONFIRM_CLEANING_')) {
          const extracted = buttonId.replace('CONFIRM_CLEANING_', '').trim();
          if (extracted && extracted.includes('-W')) weekId = extracted;
        }

        const existing = chores.cleaningRecords[weekId] || {
          weekId,
          moradorId: matchedMorador?.id || '',
          room: matchedMorador?.room || '',
        };

        const now = new Date().toISOString();
        chores.cleaningRecords[weekId] = {
          ...existing,
          confirmed: true,
          confirmedAt: now,
          confirmedBy: matchedMorador?.name || senderContactName || 'WhatsApp',
          whatsappSent: true,
        };
        chores.updatedAt = now;
        await saveChoresToBlob(chores);
        updated = true;

        // Instant Free Thank-You Acknowledgment Reply
        if (accessToken && senderPhone) {
          const thankYouText = `🎉 Manutenção de limpeza confirmada! Muito obrigado pelo capricho no apê 802.`;
          await sendReplyMessage(phoneNumberId, accessToken, senderPhone, thankYouText);
        }
      }

      return sendJsonResponse(res, 200, {
        status: 'ok',
        updated,
        type: isTrashConfirm ? 'trash' : isCleaningConfirm ? 'cleaning' : 'none',
      });
    } catch (err: any) {
      console.error('[WhatsApp Webhook Handler Error]:', err);
      // Meta requires a 200 return to prevent infinite retries
      return sendJsonResponse(res, 200, { status: 'error', error: err.message });
    }
  }

  return sendRawResponse(res, 405, 'Method Not Allowed');
}
