import { ROOMMATES } from '../constants/roommates';
import { MoradorId, Reservation } from '../types';

const STORAGE_KEY_RESERVATIONS = 'gaiola802_reservations_v3';
const STORAGE_KEY_ACTIVE_USER = 'gaiola802_active_user_v3';

export function getActiveMoradorId(): MoradorId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_USER) as MoradorId;
    if (saved && ROOMMATES.some((m) => m.id === saved)) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'wellington';
}

export function setActiveMoradorId(id: MoradorId): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_USER, id);
  } catch {
    // ignore
  }
}

export function generateInitialSeedReservations(): Reservation[] {
  const now = new Date();
  
  // Seed 1: Thaciane lavou roupas de dia a dia no Varal 1
  const thacianeStart = new Date(now);
  thacianeStart.setHours(now.getHours() - 3, 0, 0, 0); // 3 hours ago
  const thacianeMachineEnd = new Date(thacianeStart.getTime() + 75 * 60 * 1000); // 1h15
  const thacianeHangDeadline = new Date(thacianeMachineEnd.getTime() + 30 * 60 * 1000);
  const thacianeDryEnd = new Date(thacianeHangDeadline.getTime() + 360 * 60 * 1000); // ~6h drying
  const thacianeRackRelease = new Date(thacianeDryEnd.getTime() + 60 * 60 * 1000);

  // Seed 2: Pedro lavou roupas de academia no Varal 2
  const pedroStart = new Date(now);
  pedroStart.setHours(now.getHours() - 1, 30, 0, 0); // 1.5 hour ago
  const pedroMachineEnd = new Date(pedroStart.getTime() + 45 * 60 * 1000);
  const pedroHangDeadline = new Date(pedroMachineEnd.getTime() + 30 * 60 * 1000);
  const pedroDryEnd = new Date(pedroHangDeadline.getTime() + 200 * 60 * 1000);
  const pedroRackRelease = new Date(pedroDryEnd.getTime() + 60 * 60 * 1000);

  // Seed 3: Wellington agendou para mais tarde hoje
  const wellingtonStart = new Date(now);
  wellingtonStart.setHours(now.getHours() + 2, 0, 0, 0); // in 2 hours
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

export function loadReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESERVATIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // parse failure
  }

  const seeded = generateInitialSeedReservations();
  saveReservations(seeded);
  return seeded;
}

export function saveReservations(reservations: Reservation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(reservations));
  } catch {
    // quota exceeded or disabled
  }
}

export function addReservation(reservation: Reservation): Reservation[] {
  const current = loadReservations();
  const updated = [...current, reservation].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  saveReservations(updated);
  return updated;
}

export function updateReservation(reservation: Reservation): Reservation[] {
  const current = loadReservations();
  const updated = current.map((r) => (r.id === reservation.id ? reservation : r));
  saveReservations(updated);
  return updated;
}

export function deleteReservation(id: string): Reservation[] {
  const current = loadReservations();
  const updated = current.filter((r) => r.id !== id);
  saveReservations(updated);
  return updated;
}

export function releaseReservationEarly(id: string): Reservation[] {
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
  return updated;
}
