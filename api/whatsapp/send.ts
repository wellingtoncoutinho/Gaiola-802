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
    const { to, text, taskType, taskId, moradorId, buttonText, buttonPayload } = body || {};

    if (!to || !text) {
      return sendResponse(res, 400, { error: 'Campos "to" e "text" são obrigatórios.' });
    }

    // Clean phone number (keep digits only, ensure DDI 55 if Brazilian format)
    let cleanPhone = to.replace(/[^\d]/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    // Retrieve Meta credentials from Blob settings, environment, or verified default
    const chores = await getChoresFromBlob();
    const phoneNumberId =
      process.env.META_WA_PHONE_NUMBER_ID ||
      chores.metaConfig?.phoneNumberId ||
      '1261779623696198';
    const accessToken =
      process.env.META_WA_ACCESS_TOKEN || chores.metaConfig?.accessToken || '';

    if (!phoneNumberId || !accessToken) {
      return sendResponse(res, 400, {
        success: false,
        error:
          'Credenciais da API da Meta não configuradas. Preencha o "Access Token" no painel de configurações para enviar mensagens automáticas.',
        requiresConfig: true,
      });
    }

    // Build Interactive Button or Text Payload
    let buttonTitle = buttonText;
    let replyId = buttonPayload;

    if (!buttonTitle) {
      if (taskType === 'trash') {
        buttonTitle = 'Confirmar retirada';
        replyId = replyId || `CONFIRM_TRASH_${taskId || 'today'}`;
      } else if (taskType === 'cleaning') {
        buttonTitle = 'Limpeza concluída';
        replyId = replyId || `CONFIRM_CLEANING_${taskId || 'week'}`;
      }
    }

    // Button title in WhatsApp Cloud API must be <= 20 chars
    if (buttonTitle && buttonTitle.length > 20) {
      buttonTitle = buttonTitle.slice(0, 20);
    }

    const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    let payload: any;
    if (buttonTitle && replyId) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: text,
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: replyId,
                  title: buttonTitle,
                },
              },
            ],
          },
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      };
    }

    let metaRes = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let metaData = await metaRes.json();

    // Fallback 1: Try approved template if interactive message fails (required outside 24h window)
    if (!metaRes.ok && taskType) {
      const templateName = taskType === 'trash' ? 'gaiola_aviso_lixo' : 'gaiola_aviso_limpeza';
      const templatePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: moradorId || 'Morador' }],
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
        metaData = await templateRes.json();
      }
    }

    // Fallback 2: Plain text with reply instructions
    if (!metaRes.ok && payload.type === 'interactive') {
      console.warn('[Meta WhatsApp API] Interactive message failed, retrying plain text...', metaData.error);
      const textFallbackPayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: `${text}\n\n👉 Responda "${buttonTitle}" nesta conversa para confirmar automaticamente.`,
        },
      };

      const fallbackRes = await fetch(metaApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textFallbackPayload),
      });

      if (fallbackRes.ok) {
        metaRes = fallbackRes;
        metaData = await fallbackRes.json();
      }
    }

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
      interactiveSent: payload.type === 'interactive',
      metaResponse: metaData,
      phoneSent: cleanPhone,
    });
  } catch (err: any) {
    console.error('[WhatsApp Send Handler Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
