import { getChoresFromBlob, saveChoresToBlob } from '../chores.ts';

function sendResponse(res: any, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const { to, text, taskType, taskId, moradorId } = body || {};

    if (!to || !text) {
      return sendResponse(res, 400, { error: 'Campos "to" e "text" são obrigatórios.' });
    }

    // Clean phone number (keep digits only, ensure DDI 55 if Brazilian format)
    let cleanPhone = to.replace(/[^\d]/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Retrieve Meta credentials from Blob settings or environment
    const chores = await getChoresFromBlob();
    const phoneNumberId =
      process.env.META_WA_PHONE_NUMBER_ID || chores.metaConfig?.phoneNumberId || '';
    const accessToken =
      process.env.META_WA_ACCESS_TOKEN || chores.metaConfig?.accessToken || '';

    if (!phoneNumberId || !accessToken) {
      return sendResponse(res, 400, {
        success: false,
        error:
          'Credenciais da API da Meta não configuradas. Preencha o "Phone Number ID" e o "Access Token" no painel de configurações ou utilize o link de envio direto.',
        requiresConfig: true,
      });
    }

    // Call Meta WhatsApp Cloud API
    const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: true,
        body: text,
      },
    };

    const metaRes = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok || metaData.error) {
      console.error('[Meta WhatsApp API Error]:', metaData.error);
      return sendResponse(res, metaRes.status || 400, {
        success: false,
        error:
          metaData.error?.message ||
          'Erro retornado pela API da Meta ao tentar enviar a mensagem de WhatsApp.',
        details: metaData.error,
      });
    }

    // If message sent successfully, mark in database
    if (taskType && taskId) {
      const now = new Date().toISOString();
      if (taskType === 'trash') {
        const existing = chores.trashRecords[taskId] || {
          date: taskId,
          moradorId: moradorId || '',
          room: '',
          confirmed: false,
        };
        chores.trashRecords[taskId] = {
          ...existing,
          whatsappSent: true,
          whatsappSentAt: now,
        };
      } else if (taskType === 'cleaning') {
        const existing = chores.cleaningRecords[taskId] || {
          weekId: taskId,
          weekNumber: 0,
          year: 2026,
          startDate: '',
          fridayDate: '',
          endDate: '',
          moradorId: moradorId || '',
          room: '',
          confirmed: false,
        };
        chores.cleaningRecords[taskId] = {
          ...existing,
          whatsappSent: true,
          whatsappSentAt: now,
        };
      }
      chores.updatedAt = now;
      await saveChoresToBlob(chores);
    }

    return sendResponse(res, 200, {
      success: true,
      metaResponse: metaData,
      phoneSent: cleanPhone,
    });
  } catch (err: any) {
    console.error('[WhatsApp Send Handler Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
