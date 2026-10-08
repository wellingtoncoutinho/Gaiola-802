import { ROOMMATES } from '../constants/roommates';
import { MoradorId, Reservation } from '../types';

const STORAGE_KEY_RESERVATIONS = 'gaiola802_reservations_v5';
const STORAGE_KEY_INITIALIZED = 'gaiola802_initialized_v5';
const STORAGE_KEY_ACTIVE_USER = 'gaiola802_active_user_v3';

const CLOUD_BLOB_FALLBACK_URL =
  'https://qnvauhobbyljfv0c.public.blob.vercel-storage.com/reservations.json';

// Cross-tab broadcast channel for instantaneous same-device sync
const syncChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('gaiola802_reservations_channel_v5')
    : null;

const syncListeners = new Set<(reservations: Reservation[]) => void>();

function notifySync(reservations: Reservation[]): void {
  try {
    syncChannel?.postMessage({ type: 'SYNC_RESERVATIONS', payload: reservations });
  } catch {
    // ignore
  }
  for (const listener of syncListeners) {
    try {
      listener(reservations);
    } catch (e) {
      console.error('[Storage] Listener error:', e);
    }
  }
}

export function subscribeToSync(onSync: (reservations: Reservation[]) => void): () => void {
  syncListeners.add(onSync);

  if (syncChannel) {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_RESERVATIONS' && Array.isArray(event.data.payload)) {
        onSync(event.data.payload);
      }
    };
    syncChannel.addEventListener('message', handleMessage);
  }

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
    syncListeners.delete(onSync);
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

  // Seed: Wellington agendou para amanhã
  const wellingtonStart = new Date(now);
  wellingtonStart.setDate(wellingtonStart.getDate() + 1);
  wellingtonStart.setHours(11, 0, 0, 0);
  const wellingtonMachineEnd = new Date(wellingtonStart.getTime() + 75 * 60 * 1000);
  const wellingtonHangDeadline = new Date(wellingtonMachineEnd.getTime() + 30 * 60 * 1000);
  const wellingtonDryEnd = new Date(wellingtonHangDeadline.getTime() + 540 * 60 * 1000);
  const wellingtonRackRelease = new Date(wellingtonDryEnd.getTime() + 60 * 60 * 1000);

  return [
    {
      id: 'res-seed-wellington',
      moradorId: 'wellington',
      loadTypeId: 'dia_a_dia',
      startTime: wellingtonStart.toISOString(),
      machineEndTime: wellingtonMachineEnd.toISOString(),
      hangDeadline: wellingtonHangDeadline.toISOString(),
      dryEndTime: wellingtonDryEnd.toISOString(),
      rackReleaseTime: wellingtonRackRelease.toISOString(),
      assignedRacks: ['rack_1'],
      weatherFactor: {
        temperature: 26,
        humidity: 75,
        weatherCode: 2,
        multiplier: 1.1,
        conditionText: 'Sol & Nuvens em Copacabana',
        impactSummary: '26°C com 75% umidade • Secagem regular no Varal 1',
        windSpeed: 14,
        cloudCover: 40,
      },
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Loads current reservations synchronously from localStorage cache.
 * NOTE: Never resurrects deleted reservations! If the cache has [] or is initialized, returns [].
 */
export function loadReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESERVATIONS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed; // Returns parsed even if empty array []!
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
  return seeded;
}

/**
 * Saves reservations to local cache and broadcasts across tabs and in-memory listeners
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
 * Helper to compare two reservation lists
 */
function areListsEqual(a: Reservation[], b: Reservation[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Fetches latest reservations from server API or cloud blob fallback.
 * Updates local cache upon successful fetch and notifies UI if changed.
 */
export async function fetchReservationsFromServer(): Promise<Reservation[]> {
  // 1. Try Vercel Serverless Function /api/reservations
  try {
    const res = await fetch(`/api/reservations?t=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const current = loadReservations();
        if (!areListsEqual(current, data)) {
          saveReservations(data);
        }
        return data;
      }
    }
  } catch {
    // Attempt fallback below
  }

  // 2. Direct Cloud Blob CDN Fallback
  try {
    const blobRes = await fetch(`${CLOUD_BLOB_FALLBACK_URL}?t=${Date.now()}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
    });
    if (blobRes.ok) {
      const data = await blobRes.json();
      if (Array.isArray(data)) {
        const current = loadReservations();
        if (!areListsEqual(current, data)) {
          saveReservations(data);
        }
        return data;
      }
    }
  } catch {
    // ignore
  }

  return loadReservations();
}

/**
 * Adds or updates a reservation:
 * 1. Optimistically updates local cache and broadcasts.
 * 2. Syncs with backend API & cloud blob.
 */
export async function addReservation(reservation: Reservation): Promise<Reservation[]> {
  const current = loadReservations();
  const updated = [...current.filter((r) => r.id !== reservation.id), reservation].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  saveReservations(updated);

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', reservation }),
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
      body: JSON.stringify({ action: 'add', reservation }),
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
 * 2. Deletes on server and cloud storage.
 */
export async function deleteReservation(id: string): Promise<Reservation[]> {
  const current = loadReservations();
  const updated = current.filter((r) => r.id !== id);
  saveReservations(updated);

  try {
    const res = await fetch(`/api/reservations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
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
    const res = await fetch(`/api/reservations?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'release', id }),
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

/**
 * Cross-device live polling and lifecycle listener setup.
 * Polling every 4s ensures all roommates see additions & deletions instantly across PC and phone!
 */
let pollingInterval: any = null;

export function startLiveCloudSync(): () => void {
  // 1. Initial fetch from server
  fetchReservationsFromServer();

  // 2. Poll every 4 seconds
  if (!pollingInterval && typeof window !== 'undefined') {
    pollingInterval = setInterval(() => {
      fetchReservationsFromServer();
    }, 4000);
  }

  // 3. Sync immediately when tab regains focus or user unlocks mobile screen
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      fetchReservationsFromServer();
    }
  };

  const handleFocus = () => {
    fetchReservationsFromServer();
  };

  const handleOnline = () => {
    fetchReservationsFromServer();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  return () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}
