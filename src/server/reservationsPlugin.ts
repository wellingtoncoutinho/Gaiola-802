import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';

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
  };
  notes?: string;
  createdAt: string;
  isCompletedEarly?: boolean;
  earlyReleasedAt?: string;
}

function getInitialReservations(): Reservation[] {
  const now = new Date();

  // Seed 1: Thaciane lavou roupas de dia a dia no Varal 1
  const thacianeStart = new Date(now);
  thacianeStart.setHours(now.getHours() - 3, 0, 0, 0);
  const thacianeMachineEnd = new Date(thacianeStart.getTime() + 75 * 60 * 1000);
  const thacianeHangDeadline = new Date(thacianeMachineEnd.getTime() + 30 * 60 * 1000);
  const thacianeDryEnd = new Date(thacianeHangDeadline.getTime() + 360 * 60 * 1000);
  const thacianeRackRelease = new Date(thacianeDryEnd.getTime() + 60 * 60 * 1000);

  // Seed 2: Pedro lavou roupas de academia no Varal 2
  const pedroStart = new Date(now);
  pedroStart.setHours(now.getHours() - 1, 30, 0, 0);
  const pedroMachineEnd = new Date(pedroStart.getTime() + 45 * 60 * 1000);
  const pedroHangDeadline = new Date(pedroMachineEnd.getTime() + 30 * 60 * 1000);
  const pedroDryEnd = new Date(pedroHangDeadline.getTime() + 200 * 60 * 1000);
  const pedroRackRelease = new Date(pedroDryEnd.getTime() + 60 * 60 * 1000);

  // Seed 3: Wellington agendou para mais tarde hoje
  const wellingtonStart = new Date(now);
  wellingtonStart.setHours(now.getHours() + 2, 0, 0, 0);
  const wellingtonMachineEnd = new Date(wellingtonStart.getTime() + 75 * 60 * 1000);
  const wellingtonHangDeadline = new Date(wellingtonMachineEnd.getTime() + 30 * 60 * 1000);
  const wellingtonDryEnd = new Date(wellingtonHangDeadline.getTime() + 380 * 60 * 1000);
  const wellingtonRackRelease = new Date(wellingtonDryEnd.getTime() + 60 * 60 * 1000);

  return [
    {
      id: 'res-seed-1',
      moradorId: 'thaciane',
      loadTypeId: 'dia_a_dia',
      startTime: thacianeStart.toISOString(),
      machineEndTime: thacianeMachineEnd.toISOString(),
      hangDeadline: thacianeHangDeadline.toISOString(),
      dryEndTime: thacianeDryEnd.toISOString(),
      rackReleaseTime: thacianeRackRelease.toISOString(),
      assignedRacks: ['rack_1'],
      weatherFactor: {
        temperature: 28,
        humidity: 62,
        weatherCode: 1,
        multiplier: 0.85,
        conditionText: 'Sol & Brisa',
        impactSummary: '28°C com 62% umidade • Secagem 15% mais rápida',
      },
      createdAt: thacianeStart.toISOString(),
    },
    {
      id: 'res-seed-2',
      moradorId: 'pedro',
      loadTypeId: 'leve',
      startTime: pedroStart.toISOString(),
      machineEndTime: pedroMachineEnd.toISOString(),
      hangDeadline: pedroHangDeadline.toISOString(),
      dryEndTime: pedroDryEnd.toISOString(),
      rackReleaseTime: pedroRackRelease.toISOString(),
      assignedRacks: ['rack_2'],
      weatherFactor: {
        temperature: 29,
        humidity: 60,
        weatherCode: 1,
        multiplier: 0.75,
        conditionText: 'Calor de Copacabana',
        impactSummary: '29°C com 60% umidade • Secagem 25% mais rápida',
      },
      createdAt: pedroStart.toISOString(),
    },
    {
      id: 'res-seed-3',
      moradorId: 'wellington',
      loadTypeId: 'dia_a_dia',
      startTime: wellingtonStart.toISOString(),
      machineEndTime: wellingtonMachineEnd.toISOString(),
      hangDeadline: wellingtonHangDeadline.toISOString(),
      dryEndTime: wellingtonDryEnd.toISOString(),
      rackReleaseTime: wellingtonRackRelease.toISOString(),
      assignedRacks: ['rack_2'],
      weatherFactor: {
        temperature: 27,
        humidity: 66,
        weatherCode: 2,
        multiplier: 1.0,
        conditionText: 'Sol com Nuvens',
        impactSummary: '27°C agradável • Secagem no tempo de referência',
      },
      createdAt: new Date().toISOString(),
    },
  ];
}

export function reservationsApiPlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), 'data');
  const dataFile = path.resolve(dataDir, 'reservations.json');
  const sseClients = new Set<ServerResponse>();

  function loadReservations(): Reservation[] {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (fs.existsSync(dataFile)) {
        const raw = fs.readFileSync(dataFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('[Reservations API] Error reading data file:', err);
    }

    const initial = getInitialReservations();
    saveReservations(initial);
    return initial;
  }

  function saveReservations(data: Reservation[]) {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Reservations API] Error saving data file:', err);
    }
  }

  function broadcast(data: Reservation[]) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function readJsonBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res: ServerResponse, statusCode: number, data: any) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(data));
  }

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    const parsedUrl = new URL(url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    if (!pathname.startsWith('/api/reservations')) {
      return next();
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.end();
    }

    // 1. SSE Events Endpoint
    if (pathname === '/api/reservations/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send current reservations immediately upon connecting
      const current = loadReservations();
      res.write(`data: ${JSON.stringify(current)}\n\n`);

      sseClients.add(res);

      // Heartbeat ping every 25 seconds
      const pingInterval = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(pingInterval);
          sseClients.delete(res);
        }
      }, 25000);

      req.on('close', () => {
        clearInterval(pingInterval);
        sseClients.delete(res);
      });
      return;
    }

    // 2. GET /api/reservations
    if (req.method === 'GET' && (pathname === '/api/reservations' || pathname === '/api/reservations/')) {
      const data = loadReservations();
      return sendJson(res, 200, data);
    }

    // 3. POST /api/reservations (Create new reservation)
    if (req.method === 'POST' && (pathname === '/api/reservations' || pathname === '/api/reservations/')) {
      try {
        const newReservation: Reservation = await readJsonBody(req);
        if (!newReservation || !newReservation.id) {
          return sendJson(res, 400, { error: 'Invalid reservation data' });
        }

        const current = loadReservations();
        // Remove duplicate if exists then add
        const updated = [...current.filter((r) => r.id !== newReservation.id), newReservation].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        saveReservations(updated);
        broadcast(updated);
        return sendJson(res, 201, { success: true, reservation: newReservation, reservations: updated });
      } catch (err: any) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 4. PUT /api/reservations (Replace whole list)
    if (req.method === 'PUT' && (pathname === '/api/reservations' || pathname === '/api/reservations/')) {
      try {
        const body = await readJsonBody(req);
        if (!Array.isArray(body)) {
          return sendJson(res, 400, { error: 'Expected array of reservations' });
        }
        saveReservations(body);
        broadcast(body);
        return sendJson(res, 200, { success: true, reservations: body });
      } catch (err: any) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // 5. PATCH /api/reservations/:id/release (Release early)
    const releaseMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/release\/?$/);
    if (req.method === 'PATCH' && releaseMatch) {
      const id = releaseMatch[1];
      const current = loadReservations();
      const now = new Date().toISOString();
      const updated = current.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            isCompletedEarly: true,
            earlyReleasedAt: now,
          };
        }
        return r;
      });

      saveReservations(updated);
      broadcast(updated);
      return sendJson(res, 200, { success: true, reservations: updated });
    }

    // 6. DELETE /api/reservations/:id (Delete reservation)
    const deleteMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/?$/);
    if (req.method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      const current = loadReservations();
      const updated = current.filter((r) => r.id !== id);

      saveReservations(updated);
      broadcast(updated);
      return sendJson(res, 200, { success: true, deletedId: id, reservations: updated });
    }

    next();
  };

  return {
    name: 'reservations-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(handler);
    },
  };
}
