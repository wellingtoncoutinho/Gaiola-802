import { ROOMMATES } from '../constants/roommates';
import { MoradorId, Reservation } from '../types';

const STORAGE_KEY_RESERVATIONS = 'gaiola802_reservations_v4';
const STORAGE_KEY_INITIALIZED = 'gaiola802_initialized_v4';
const STORAGE_KEY_ACTIVE_USER = 'gaiola802_active_user_v3';

// Cross-tab broadcast channel for instantaneous same-device sync
const syncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('gaiola802_reservations_channel')
    : null;

function notifySync(reservations: Reservation[]): void {
  try {
    syncChannel?.postMessage({ type: 'SYNC_RESERVATIONS', payload: reservations });
  } catch {
    // ignore
  }
}

export function subscribeToSync(onSync: (reservations: Reservation[]) => void): () => void {
  if (!syncChannel) return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_RESERVATIONS' && Array.isArray(event.data.payload)) {
      onSync(event.data.payload);
    }
  };

  syncChannel.addEventListener('message', handleMessage);

  // Also listen to window storage event for fallback
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_RESERVATIONS && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (Array.isArray(parsed)) {
          onSync(parsed);
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    syncChannel.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
}

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

/**
 * Loads current reservations synchronously from localStorage cache.
 * Note: Never reseeds if user deleted all reservations!
 */
export function loadReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESERVATIONS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed; // Even if empty array!
      }
    }

    const wasInitialized = localStorage.getItem(STORAGE_KEY_INITIALIZED);
    if (wasInitialized === 'true') {
      return [];
    }
  } catch {
    // parse failure
  }

  // First time ever: initialize with seed reservations
  const seeded = generateInitialSeedReservations();
  saveReservations(seeded);
  try {
    localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
  } catch {
    // ignore
  }
  return seeded;
}

/**
 * Saves reservations to local cache and broadcasts across tabs
 */
export function saveReservations(reservations: Reservation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(reservations));
    localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
    notifySync(reservations);
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * Fetches latest reservations from server API.
 * Updates local cache upon successful fetch.
 */
export async function fetchReservationsFromServer(): Promise<Reservation[]> {
  try {
    const res = await fetch('/api/reservations', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveReservations(data);
        return data;
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not reach server, using local cache:', err);
  }
  return loadReservations();
}

/**
 * Adds a new reservation:
 * 1. Optimistically updates local cache and broadcasts.
 * 2. Syncs with backend API.
 */
export async function addReservation(reservation: Reservation): Promise<Reservation[]> {
  const current = loadReservations();
  const updated = [...current.filter((r) => r.id !== reservation.id), reservation].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  saveReservations(updated);

  // Send to server in background
  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.reservations && Array.isArray(data.reservations)) {
        saveReservations(data.reservations);
        return data.reservations;
      }
    }
  } catch (err) {
    console.warn('[Storage] Server sync failed on addReservation:', err);
  }

  return updated;
}

/**
 * Updates an existing reservation.
 */
export async function updateReservation(reservation: Reservation): Promise<Reservation[]> {
  const current = loadReservations();
  const updated = current.map((r) => (r.id === reservation.id ? reservation : r));
  saveReservations(updated);

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.reservations && Array.isArray(data.reservations)) {
        saveReservations(data.reservations);
        return data.reservations;
      }
    }
  } catch (err) {
    console.warn('[Storage] Server sync failed on updateReservation:', err);
  }

  return updated;
}

/**
 * Permanently deletes a reservation:
 * 1. Optimistically removes from local cache and broadcasts.
 * 2. Deletes on server.
 */
export async function deleteReservation(id: string): Promise<Reservation[]> {
  const current = loadReservations();
  const updated = current.filter((r) => r.id !== id);
  saveReservations(updated);

  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.reservations && Array.isArray(data.reservations)) {
        saveReservations(data.reservations);
        return data.reservations;
      }
    }
  } catch (err) {
    console.warn('[Storage] Server sync failed on deleteReservation:', err);
  }

  return updated;
}

/**
 * Releases a reservation early.
 */
export async function releaseReservationEarly(id: string): Promise<Reservation[]> {
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

  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}/release`, {
      method: 'PATCH',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.reservations && Array.isArray(data.reservations)) {
        saveReservations(data.reservations);
        return data.reservations;
      }
    }
  } catch (err) {
    console.warn('[Storage] Server sync failed on releaseReservationEarly:', err);
  }

  return updated;
}
