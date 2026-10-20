import { put } from '@vercel/blob';

const BLOB_URL = 'https://qnvauhobbyljfv0c.public.blob.vercel-storage.com/chores.json';

interface ChoresData {
  phones: Record<string, string>;
  trashRecords: Record<string, any>;
  cleaningRecords: Record<string, any>;
  metaConfig: {
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
    templateName?: string;
    testMode?: boolean;
  };
  rotationOffset: number;
  updatedAt: string;
}

const DEFAULT_CHORES_DATA: ChoresData = {
  phones: {
    pedro: '',
    yan: '',
    wellington: '',
    fabio: '',
    thaciane: '',
  },
  trashRecords: {},
  cleaningRecords: {},
  metaConfig: {
    phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID || '1261779623696198',
    accessToken: process.env.META_WA_ACCESS_TOKEN || '',
    businessAccountId: process.env.META_WA_BUSINESS_ACCOUNT_ID || '1604487048142695',
    templateName: '',
    testMode: false,
  },
  rotationOffset: 4,
  updatedAt: new Date().toISOString(),
};

let memoryCache: ChoresData | null = null;

export async function getChoresFromBlob(): Promise<ChoresData> {
  try {
    // Add ?download=1 to bypass Vercel Blob Edge CDN cache, ensuring instant fresh read
    const res = await fetch(`${BLOB_URL}?download=1&t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.phones) {
        memoryCache = data;
        return data;
      }
    }
  } catch (err) {
    console.error('[API Chores] Error reading blob:', err);
  }

  if (memoryCache !== null) {
    return memoryCache;
  }
  return DEFAULT_CHORES_DATA;
}

export async function saveChoresToBlob(data: ChoresData): Promise<void> {
  memoryCache = data;
  try {
    await put('chores.json', JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } catch (err) {
    console.error('[API Chores] Error saving blob:', err);
    throw err;
  }
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

function sendResponse(res: any, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (typeof res.status === 'function') {
      return res.status(204).end();
    }
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const confirmChore = url.searchParams.get('confirm_chore');

  try {
    // 1. GET: Fetch chores data OR 1-click confirmation redirect
    if (req.method === 'GET') {
      if (confirmChore === 'lixo') {
        const date = url.searchParams.get('date');
        const moradorId = url.searchParams.get('morador');
        if (date && moradorId) {
          const current = await getChoresFromBlob();
          current.trashRecords[date] = {
            date,
            moradorId,
            room: '',
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: moradorId,
          };
          current.updatedAt = new Date().toISOString();
          await saveChoresToBlob(current);

          // Redirect to home with confirmation flag
          res.writeHead(302, { Location: `/?confirmed=lixo&date=${date}&morador=${moradorId}` });
          return res.end();
        }
      }

      if (confirmChore === 'limpeza') {
        const week = url.searchParams.get('week');
        const moradorId = url.searchParams.get('morador');
        if (week && moradorId) {
          const current = await getChoresFromBlob();
          current.cleaningRecords[week] = {
            ...(current.cleaningRecords[week] || {}),
            weekId: week,
            moradorId,
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: moradorId,
          };
          current.updatedAt = new Date().toISOString();
          await saveChoresToBlob(current);

          res.writeHead(302, { Location: `/?confirmed=limpeza&week=${week}&morador=${moradorId}` });
          return res.end();
        }
      }

      const data = await getChoresFromBlob();
      return sendResponse(res, 200, data);
    }

    // 2. POST: Actions (set_all, confirm_trash, confirm_cleaning, update_phone, save_meta)
    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const action = body?.action;
      const current = await getChoresFromBlob();

      if (action === 'set_all' && body?.data) {
        // Smart merge so older/stale client data doesn't wipe out recent confirmations
        const incomingTrash = body.data.trashRecords || {};
        const incomingCleaning = body.data.cleaningRecords || {};

        const mergedTrash = { ...current.trashRecords };
        for (const [key, val] of Object.entries(incomingTrash)) {
          mergedTrash[key] = {
            ...(mergedTrash[key] || {}),
            ...(val as any),
          };
        }

        const mergedCleaning = { ...current.cleaningRecords };
        for (const [key, val] of Object.entries(incomingCleaning)) {
          mergedCleaning[key] = {
            ...(mergedCleaning[key] || {}),
            ...(val as any),
          };
        }

        const updated = {
          ...current,
          ...body.data,
          trashRecords: mergedTrash,
          cleaningRecords: mergedCleaning,
          updatedAt: new Date().toISOString(),
        };
        await saveChoresToBlob(updated);
        return sendResponse(res, 200, { success: true, data: updated });
      }

      if (action === 'confirm_trash' && body?.date) {
        const existing = current.trashRecords[body.date] || {};
        current.trashRecords[body.date] = {
          ...existing,
          date: body.date,
          moradorId: body.moradorId || existing.moradorId || '',
          room: body.room || existing.room || '',
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          confirmedBy: body.confirmedBy || body.moradorId || 'Morador',
          whatsappSent: existing.whatsappSent,
          whatsappSentAt: existing.whatsappSentAt,
        };
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'unconfirm_trash' && body?.date) {
        if (current.trashRecords[body.date]) {
          current.trashRecords[body.date] = {
            ...current.trashRecords[body.date],
            confirmed: false,
            confirmedAt: undefined,
            confirmedBy: undefined,
          };
        }
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'confirm_cleaning' && body?.weekId) {
        const existing = current.cleaningRecords[body.weekId] || {};
        current.cleaningRecords[body.weekId] = {
          ...existing,
          weekId: body.weekId,
          moradorId: body.moradorId || existing.moradorId || '',
          room: body.room || existing.room || '',
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          confirmedBy: body.confirmedBy || body.moradorId || 'Morador',
          notes: body.notes || existing.notes,
        };
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'unconfirm_cleaning' && body?.weekId) {
        if (current.cleaningRecords[body.weekId]) {
          current.cleaningRecords[body.weekId] = {
            ...current.cleaningRecords[body.weekId],
            confirmed: false,
            confirmedAt: undefined,
            confirmedBy: undefined,
          };
        }
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'update_phone' && body?.moradorId) {
        current.phones[body.moradorId] = body.phone || '';
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'save_settings') {
        if (body.phones && typeof body.phones === 'object') {
          current.phones = {
            ...current.phones,
            ...body.phones,
          };
        }
        if (body.metaConfig && typeof body.metaConfig === 'object') {
          current.metaConfig = {
            ...current.metaConfig,
            ...body.metaConfig,
          };
        }
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      if (action === 'save_meta' && body?.metaConfig) {
        current.metaConfig = {
          ...current.metaConfig,
          ...body.metaConfig,
        };
        current.updatedAt = new Date().toISOString();
        await saveChoresToBlob(current);
        return sendResponse(res, 200, { success: true, data: current });
      }

      // Default fallback: replace or merge
      if (body && typeof body === 'object') {
        const merged = { ...current, ...body, updatedAt: new Date().toISOString() };
        await saveChoresToBlob(merged);
        return sendResponse(res, 200, { success: true, data: merged });
      }

      return sendResponse(res, 400, { error: 'Invalid payload' });
    }

    return sendResponse(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[API Chores Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
