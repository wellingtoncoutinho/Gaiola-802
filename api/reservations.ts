import type { IncomingMessage, ServerResponse } from 'http';
import { put } from '@vercel/blob';

const BLOB_URL = 'https://qnvauhobbyljfv0c.public.blob.vercel-storage.com/reservations.json';

interface Reservation {
  id: string;
  moradorId: string;
  loadTypeId: string;
  startTime: string;
  machineEndTime: string;
  hangDeadline: string;
  dryEndTime: string;
  rackReleaseTime: string;
  assignedRacks: ('rack_1' | 'rack_2')[];
  weatherFactor: {
    temperature: number;
    humidity: number;
    weatherCode: number;
    multiplier: number;
    conditionText: string;
    impactSummary: string;
    windSpeed?: number;
    cloudCover?: number;
  };
  notes?: string;
  createdAt: string;
  isCompletedEarly?: boolean;
  earlyReleasedAt?: string;
}

// In-memory cache fallback in case of transient blob fetch errors
let memoryCache: Reservation[] | null = null;

async function getReservationsFromBlob(): Promise<Reservation[]> {
  try {
    const res = await fetch(`${BLOB_URL}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        memoryCache = data;
        return data;
      }
    }
  } catch (err) {
    console.error('[API] Error reading blob:', err);
  }

  if (memoryCache !== null) {
    return memoryCache;
  }
  return [];
}

async function saveReservationsToBlob(data: Reservation[]): Promise<void> {
  memoryCache = data;
  try {
    await put('reservations.json', JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } catch (err) {
    console.error('[API] Error saving blob:', err);
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
  const pathname = url.pathname;
  const idFromQuery = url.searchParams.get('id') || req.query?.id;

  try {
    // 1. GET: Fetch all reservations
    if (req.method === 'GET') {
      const data = await getReservationsFromBlob();
      return sendResponse(res, 200, data);
    }

    // 2. DELETE: Remove reservation by ID
    if (req.method === 'DELETE') {
      const body = await parseJsonBody(req);
      const targetId = idFromQuery || body?.id || pathname.split('/').filter(Boolean).pop();

      if (!targetId || targetId === 'reservations') {
        return sendResponse(res, 400, { error: 'Missing reservation ID' });
      }

      const current = await getReservationsFromBlob();
      const updated = current.filter((r) => r.id !== targetId);
      await saveReservationsToBlob(updated);
      return sendResponse(res, 200, { success: true, deletedId: targetId, reservations: updated });
    }

    // 3. PATCH: Release early or update
    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      const targetId = idFromQuery || body?.id;

      if (!targetId) {
        return sendResponse(res, 400, { error: 'Missing reservation ID' });
      }

      const current = await getReservationsFromBlob();
      const now = new Date().toISOString();
      const updated = current.map((r) => {
        if (r.id === targetId) {
          return {
            ...r,
            isCompletedEarly: true,
            earlyReleasedAt: now,
          };
        }
        return r;
      });

      await saveReservationsToBlob(updated);
      return sendResponse(res, 200, { success: true, reservations: updated });
    }

    // 4. POST: Flexible endpoint supporting add, delete, release, and setAll
    if (req.method === 'POST') {
      const body = await parseJsonBody(req);

      // Handle action: 'delete'
      if (body?.action === 'delete' && body?.id) {
        const current = await getReservationsFromBlob();
        const updated = current.filter((r) => r.id !== body.id);
        await saveReservationsToBlob(updated);
        return sendResponse(res, 200, { success: true, deletedId: body.id, reservations: updated });
      }

      // Handle action: 'release'
      if (body?.action === 'release' && body?.id) {
        const current = await getReservationsFromBlob();
        const now = new Date().toISOString();
        const updated = current.map((r) => {
          if (r.id === body.id) {
            return {
              ...r,
              isCompletedEarly: true,
              earlyReleasedAt: now,
            };
          }
          return r;
        });
        await saveReservationsToBlob(updated);
        return sendResponse(res, 200, { success: true, reservations: updated });
      }

      // Handle action: 'setAll' or array
      if (body?.action === 'setAll' && Array.isArray(body?.reservations)) {
        await saveReservationsToBlob(body.reservations);
        return sendResponse(res, 200, { success: true, reservations: body.reservations });
      }
      if (Array.isArray(body)) {
        await saveReservationsToBlob(body);
        return sendResponse(res, 200, { success: true, reservations: body });
      }

      // Handle new or updated reservation
      const newReservation: Reservation = body?.reservation || body;
      if (!newReservation || !newReservation.id) {
        return sendResponse(res, 400, { error: 'Invalid reservation data' });
      }

      const current = await getReservationsFromBlob();
      const updated = [...current.filter((r) => r.id !== newReservation.id), newReservation].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      await saveReservationsToBlob(updated);
      return sendResponse(res, 201, { success: true, reservation: newReservation, reservations: updated });
    }

    // 5. PUT: Replace all reservations
    if (req.method === 'PUT') {
      const body = await parseJsonBody(req);
      if (!Array.isArray(body)) {
        return sendResponse(res, 400, { error: 'Expected array of reservations' });
      }
      await saveReservationsToBlob(body);
      return sendResponse(res, 200, { success: true, reservations: body });
    }

    return sendResponse(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[API Error]:', err);
    return sendResponse(res, 500, { error: err.message || 'Internal Server Error' });
  }
}
