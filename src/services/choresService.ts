import { MoradorId, ChoresState, TrashDutyRecord, CleaningWeekDuty, MetaWhatsAppConfig } from '../types';
import { ROOMMATES, TRASH_SCHEDULE_RULES, CLEANING_ROTATION_ROOMS, DEFAULT_ROOMMATE_PHONES } from '../constants/roommates';

const CHORES_STORAGE_KEY = 'gaiola802_chores_v2';
const CHORES_CHANNEL_NAME = 'gaiola802_chores_channel_v2';

const choresChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(CHORES_CHANNEL_NAME)
    : null;

const choresListeners = new Set<(state: ChoresState) => void>();

function notifyChoresSync(state: ChoresState): void {
  try {
    choresChannel?.postMessage({ type: 'SYNC_CHORES', payload: state });
  } catch {
    // ignore
  }
  for (const listener of choresListeners) {
    try {
      listener(state);
    } catch (e) {
      console.error('[ChoresService] Listener error:', e);
    }
  }
}

export function subscribeToChores(callback: (state: ChoresState) => void): () => void {
  choresListeners.add(callback);

  if (choresChannel) {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_CHORES' && e.data?.payload) {
        callback(e.data.payload);
      }
    };
    choresChannel.addEventListener('message', handleMsg);
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === CHORES_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed) callback(parsed);
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    choresListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getDefaultChoresState(): ChoresState {
  return {
    phones: { ...DEFAULT_ROOMMATE_PHONES },
    trashRecords: {},
    cleaningRecords: {},
    metaConfig: {
      phoneNumberId: '1261779623696198',
      accessToken: '',
      businessAccountId: '1604487048142695',
      templateName: '',
      testMode: false,
    },
    rotationOffset: 4,
    updatedAt: new Date().toISOString(),
  };
}

export function loadChoresLocal(): ChoresState {
  try {
    const raw = localStorage.getItem(CHORES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...getDefaultChoresState(),
          ...parsed,
          phones: { ...DEFAULT_ROOMMATE_PHONES, ...(parsed.phones || {}) },
          trashRecords: parsed.trashRecords || {},
          cleaningRecords: parsed.cleaningRecords || {},
          metaConfig: { ...getDefaultChoresState().metaConfig, ...(parsed.metaConfig || {}) },
        };
      }
    }
  } catch {
    // fallback
  }
  const defaultState = getDefaultChoresState();
  saveChoresLocal(defaultState);
  return defaultState;
}

export function saveChoresLocal(state: ChoresState): void {
  try {
    localStorage.setItem(CHORES_STORAGE_KEY, JSON.stringify(state));
    notifyChoresSync(state);
  } catch {
    // ignore
  }
}

/**
 * Fetches chores data from Vercel Serverless API / Blob
 */
export async function fetchChoresFromServer(): Promise<ChoresState> {
  try {
    const res = await fetch(`/api/chores?t=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.phones) {
        const local = loadChoresLocal();

        // Intelligent bidirectional merge: don't let transient cache overwrite active confirmations
        const mergedTrash: Record<string, TrashDutyRecord> = { ...(data.trashRecords || {}) };
        if (local.trashRecords) {
          for (const [key, localRec] of Object.entries(local.trashRecords)) {
            if (localRec?.confirmed) {
              const serverRec = mergedTrash[key];
              if (!serverRec || !serverRec.confirmed) {
                mergedTrash[key] = localRec;
              }
            }
          }
        }

        const mergedCleaning: Record<string, CleaningWeekDuty> = { ...(data.cleaningRecords || {}) };
        if (local.cleaningRecords) {
          for (const [key, localRec] of Object.entries(local.cleaningRecords)) {
            if (localRec?.confirmed) {
              const serverRec = mergedCleaning[key];
              if (!serverRec || !serverRec.confirmed) {
                mergedCleaning[key] = localRec;
              }
            }
          }
        }

        const merged: ChoresState = {
          ...getDefaultChoresState(),
          ...data,
          phones: { ...DEFAULT_ROOMMATE_PHONES, ...(data.phones || {}) },
          trashRecords: mergedTrash,
          cleaningRecords: mergedCleaning,
          metaConfig: { ...getDefaultChoresState().metaConfig, ...(data.metaConfig || {}) },
        };
        saveChoresLocal(merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Could not reach /api/chores, using local cache:', err);
  }
  return loadChoresLocal();
}

/**
 * Sync state to server
 */
export async function syncChoresToServer(state: ChoresState): Promise<ChoresState> {
  saveChoresLocal(state);
  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_all', data: state }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.data) {
        saveChoresLocal(serverData.data);
        return serverData.data;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Server sync failed:', err);
  }
  return state;
}

/**
 * Format date to YYYY-MM-DD in local timezone
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get Trash Duty details for a given date
 */
export function getTrashDutyForDate(date: Date, chores: ChoresState): {
  dateKey: string;
  weekday: number; // 0=Dom, 1=Seg...
  weekdayName: string;
  isWeekend: boolean;
  rule: (typeof TRASH_SCHEDULE_RULES)[0] | null;
  moradorId: MoradorId | null;
  moradorName: string;
  roomName: string;
  phone: string;
  record: TrashDutyRecord | null;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
} {
  const dateKey = formatDateKey(date);
  const weekday = date.getDay(); // 0 to 6
  const isWeekend = weekday === 0 || weekday === 6;

  const rule = TRASH_SCHEDULE_RULES.find((r) => r.weekday === weekday) || null;
  const moradorId = rule ? rule.defaultMoradorId : null;
  const morador = moradorId ? ROOMMATES.find((m) => m.id === moradorId) : null;

  const record = chores.trashRecords[dateKey] || null;
  const isConfirmed = record?.confirmed === true;

  const weekdayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];

  return {
    dateKey,
    weekday,
    weekdayName: weekdayNames[weekday],
    isWeekend,
    rule,
    moradorId,
    moradorName: morador?.name || 'Não escalado',
    roomName: rule?.room || (isWeekend ? 'Fim de semana (Livre)' : ''),
    phone: moradorId ? chores.phones[moradorId] || '' : '',
    record,
    isConfirmed,
    confirmedAt: record?.confirmedAt,
    confirmedBy: record?.confirmedBy,
  };
}

/**
 * Helper to compute ISO week number & weekId (e.g. "2026-W43")
 */
export function getISOWeekInfo(date: Date): {
  weekId: string;
  weekNumber: number;
  year: number;
  startDate: string; // Monday
  fridayDate: string; // Friday (Reminder)
  endDate: string; // Sunday
} {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // 0=Monday, 6=Sunday
  target.setDate(target.getDate() - dayNr + 3); // Thursday
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = date.getFullYear();

  // Find Monday of this week
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayNr);
  monday.setHours(0, 0, 0, 0);

  // Friday of this week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  // Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekId: `${year}-W${String(weekNumber).padStart(2, '0')}`,
    weekNumber,
    year,
    startDate: formatDateKey(monday),
    fridayDate: formatDateKey(friday),
    endDate: formatDateKey(sunday),
  };
}

/**
 * Get Cleaning Maintenance Duty details for a given date / week
 */
export function getCleaningDutyForWeek(
  date: Date,
  chores: ChoresState
): CleaningWeekDuty & {
  moradorName: string;
  phone: string;
  isCurrentWeek: boolean;
  isFridayOrLater: boolean;
} {
  const weekInfo = getISOWeekInfo(date);
  const currentWeekInfo = getISOWeekInfo(new Date());

  const rotation = CLEANING_ROTATION_ROOMS;
  // Compute responsible room by cycling week number
  const rotationIndex = Math.abs((weekInfo.weekNumber + (chores.rotationOffset || 0)) % rotation.length);
  const assigned = rotation[rotationIndex];

  const morador = ROOMMATES.find((m) => m.id === assigned.moradorId) || ROOMMATES[0];
  const record = chores.cleaningRecords[weekInfo.weekId];

  const today = new Date();
  const dayOfWeek = today.getDay();
  const isFridayOrLater = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

  return {
    weekId: weekInfo.weekId,
    weekNumber: weekInfo.weekNumber,
    year: weekInfo.year,
    startDate: weekInfo.startDate,
    fridayDate: weekInfo.fridayDate,
    endDate: weekInfo.endDate,
    moradorId: assigned.moradorId,
    room: assigned.room,
    confirmed: record ? record.confirmed : false,
    confirmedAt: record?.confirmedAt,
    confirmedBy: record?.confirmedBy,
    notes: record?.notes,
    whatsappSent: record?.whatsappSent,
    whatsappSentAt: record?.whatsappSentAt,
    moradorName: morador.name,
    phone: chores.phones[assigned.moradorId] || '',
    isCurrentWeek: weekInfo.weekId === currentWeekInfo.weekId,
    isFridayOrLater,
  };
}

/**
 * Get list of cleaning duties for the next N weeks
 */
export function getUpcomingCleaningDuties(chores: ChoresState, count = 5) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i * 7);
    list.push(getCleaningDutyForWeek(d, chores));
  }
  return list;
}

/**
 * Actions: Confirm / Unconfirm Trash Duty
 */
export async function confirmTrashDuty(
  dateKey: string,
  moradorId: MoradorId,
  confirmedByName?: string
): Promise<ChoresState> {
  const current = loadChoresLocal();
  const morador = ROOMMATES.find((m) => m.id === moradorId);
  const name = confirmedByName || morador?.name || 'Morador';

  const updatedRecord: TrashDutyRecord = {
    date: dateKey,
    moradorId,
    room: morador?.room || '',
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    confirmedBy: name,
    whatsappSent: current.trashRecords[dateKey]?.whatsappSent,
    whatsappSentAt: current.trashRecords[dateKey]?.whatsappSentAt,
  };

  const newState: ChoresState = {
    ...current,
    trashRecords: {
      ...current.trashRecords,
      [dateKey]: updatedRecord,
    },
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately persist locally and broadcast to UI
  saveChoresLocal(newState);

  // 2. Send dedicated atomic confirm_trash action to server
  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm_trash',
        date: dateKey,
        moradorId,
        room: morador?.room || '',
        confirmedBy: name,
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.data) {
        saveChoresLocal(serverData.data);
        return serverData.data;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Server confirm_trash failed, using local cache:', err);
  }

  return newState;
}

export async function unconfirmTrashDuty(dateKey: string): Promise<ChoresState> {
  const current = loadChoresLocal();
  const existing = current.trashRecords[dateKey];
  if (!existing) return current;

  const newState: ChoresState = {
    ...current,
    trashRecords: {
      ...current.trashRecords,
      [dateKey]: {
        ...existing,
        confirmed: false,
        confirmedAt: undefined,
        confirmedBy: undefined,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  saveChoresLocal(newState);

  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unconfirm_trash',
        date: dateKey,
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.data) {
        saveChoresLocal(serverData.data);
        return serverData.data;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Server unconfirm_trash failed, using local cache:', err);
  }

  return newState;
}

/**
 * Actions: Confirm / Unconfirm Cleaning Duty
 */
export async function confirmCleaningDuty(
  weekId: string,
  moradorId: MoradorId,
  confirmedByName?: string,
  notes?: string
): Promise<ChoresState> {
  const current = loadChoresLocal();
  const morador = ROOMMATES.find((m) => m.id === moradorId);
  const name = confirmedByName || morador?.name || 'Morador';

  const existing = current.cleaningRecords[weekId];
  const d = new Date();
  const weekInfo = getISOWeekInfo(d);

  const updatedRecord: CleaningWeekDuty = {
    weekId,
    weekNumber: weekInfo.weekNumber,
    year: weekInfo.year,
    startDate: weekInfo.startDate,
    fridayDate: weekInfo.fridayDate,
    endDate: weekInfo.endDate,
    moradorId,
    room: morador?.room || '',
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    confirmedBy: name,
    notes: notes || existing?.notes,
    whatsappSent: existing?.whatsappSent,
    whatsappSentAt: existing?.whatsappSentAt,
  };

  const newState: ChoresState = {
    ...current,
    cleaningRecords: {
      ...current.cleaningRecords,
      [weekId]: updatedRecord,
    },
    updatedAt: new Date().toISOString(),
  };

  saveChoresLocal(newState);

  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm_cleaning',
        weekId,
        moradorId,
        room: morador?.room || '',
        confirmedBy: name,
        notes,
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.data) {
        saveChoresLocal(serverData.data);
        return serverData.data;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Server confirm_cleaning failed, using local cache:', err);
  }

  return newState;
}

export async function unconfirmCleaningDuty(weekId: string): Promise<ChoresState> {
  const current = loadChoresLocal();
  const existing = current.cleaningRecords[weekId];
  if (!existing) return current;

  const newState: ChoresState = {
    ...current,
    cleaningRecords: {
      ...current.cleaningRecords,
      [weekId]: {
        ...existing,
        confirmed: false,
        confirmedAt: undefined,
        confirmedBy: undefined,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  saveChoresLocal(newState);

  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unconfirm_cleaning',
        weekId,
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.data) {
        saveChoresLocal(serverData.data);
        return serverData.data;
      }
    }
  } catch (err) {
    console.warn('[ChoresService] Server unconfirm_cleaning failed, using local cache:', err);
  }

  return newState;
}

/**
 * Update roommate phone number
 */
export async function updateRoommatePhone(moradorId: MoradorId, phone: string): Promise<ChoresState> {
  const current = loadChoresLocal();
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  const newState: ChoresState = {
    ...current,
    phones: {
      ...current.phones,
      [moradorId]: cleanPhone,
    },
    updatedAt: new Date().toISOString(),
  };

  return syncChoresToServer(newState);
}

/**
 * Save Meta WhatsApp Config
 */
export async function updateMetaConfig(config: Partial<MetaWhatsAppConfig>): Promise<ChoresState> {
  const current = loadChoresLocal();
  const newState: ChoresState = {
    ...current,
    metaConfig: {
      ...current.metaConfig,
      ...config,
    },
    updatedAt: new Date().toISOString(),
  };

  return syncChoresToServer(newState);
}

/**
 * Save Phones and Meta WhatsApp Config atomically in a single request
 */
export async function saveChoresSettings(
  newPhones: Record<string, string>,
  newMetaConfig: Partial<MetaWhatsAppConfig>
): Promise<ChoresState> {
  const current = loadChoresLocal();
  const cleanedPhones: Record<string, string> = {};
  for (const [id, num] of Object.entries(newPhones)) {
    let clean = (num || '').replace(/[^\d]/g, '');
    if (clean.startsWith('55') && clean.length > 11) {
      // already has 55
    } else if (clean && !clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
      clean = `55${clean}`;
    }
    cleanedPhones[id] = clean;
  }

  const newState: ChoresState = {
    ...current,
    phones: {
      ...current.phones,
      ...cleanedPhones,
    },
    metaConfig: {
      ...current.metaConfig,
      ...newMetaConfig,
    },
    updatedAt: new Date().toISOString(),
  };

  saveChoresLocal(newState);

  try {
    const res = await fetch('/api/chores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_settings',
        phones: newState.phones,
        metaConfig: newState.metaConfig,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data) {
        saveChoresLocal(data.data);
        return data.data;
      }
    }
  } catch (e) {
    console.error('[ChoresService] saveChoresSettings server error:', e);
  }

  return newState;
}

/**
 * Generate WhatsApp message text and direct confirmation URL
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://gaiola-802.vercel.app';
}

export function generateTrashMessage(
  moradorName: string,
  _roomName?: string,
  dateKey?: string,
  moradorId?: MoradorId
): { messageText: string; buttonText: string; buttonPayload: string; confirmUrl: string } {
  const baseUrl = getAppBaseUrl();
  const confirmUrl = `${baseUrl}/?confirm_chore=lixo&date=${dateKey || ''}&morador=${moradorId || ''}`;
  const messageText = `Olá, ${moradorName}, hoje é dia de tirar o lixo da casa. Clique em 'Confirmar retirada' somente quando retirar o lixo.`;
  const buttonText = 'Confirmar retirada';
  const buttonPayload = `CONFIRM_TRASH_${dateKey || 'today'}`;

  return { messageText, buttonText, buttonPayload, confirmUrl };
}

export function generateCleaningMessage(
  moradorName: string,
  _roomName?: string,
  weekId?: string,
  moradorId?: MoradorId
): { messageText: string; buttonText: string; buttonPayload: string; confirmUrl: string } {
  const baseUrl = getAppBaseUrl();
  const confirmUrl = `${baseUrl}/?confirm_chore=limpeza&week=${weekId || ''}&morador=${moradorId || ''}`;
  const messageText = `Olá, ${moradorName}, hoje é sexta-feira e é dia da manutenção de limpeza do apartamento.

Checklist:
• Checar se as bancadas e as pias estão limpas
• Verificar lixeiras e reposição de sacos
• Manutenção do chão das áreas comuns`;
  const buttonText = 'Limpeza concluída';
  const buttonPayload = `CONFIRM_CLEANING_${weekId || 'week'}`;

  return { messageText, buttonText, buttonPayload, confirmUrl };
}

/**
 * Send WhatsApp via Meta Cloud API or Fallback
 */
export async function sendWhatsAppNotification(params: {
  toPhone: string;
  messageText: string;
  taskType: 'trash' | 'cleaning';
  taskId: string;
  moradorId: MoradorId;
  buttonText?: string;
  buttonPayload?: string;
}): Promise<{ success: boolean; error?: string; method: 'meta' | 'fallback_ready' }> {
  const cleanPhone = params.toPhone.replace(/[^\d]/g, '');
  if (!cleanPhone) {
    return { success: false, error: 'Número de telefone não informado para este morador.', method: 'meta' };
  }

  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: cleanPhone,
        text: params.messageText,
        taskType: params.taskType,
        taskId: params.taskId,
        moradorId: params.moradorId,
        buttonText: params.buttonText,
        buttonPayload: params.buttonPayload,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Mark as sent in local state
      const current = loadChoresLocal();
      if (params.taskType === 'trash') {
        const existing = current.trashRecords[params.taskId] || {
          date: params.taskId,
          moradorId: params.moradorId,
          room: '',
          confirmed: false,
        };
        current.trashRecords[params.taskId] = {
          ...existing,
          whatsappSent: true,
          whatsappSentAt: new Date().toISOString(),
        };
      } else {
        const existing = current.cleaningRecords[params.taskId] || {
          weekId: params.taskId,
          weekNumber: 0,
          year: 2026,
          startDate: '',
          fridayDate: '',
          endDate: '',
          moradorId: params.moradorId,
          room: '',
          confirmed: false,
        };
        current.cleaningRecords[params.taskId] = {
          ...existing,
          whatsappSent: true,
          whatsappSentAt: new Date().toISOString(),
        };
      }
      saveChoresLocal(current);

      return { success: true, method: 'meta' };
    } else {
      return {
        success: false,
        error: data.error || 'Erro ao enviar pela API da Meta.',
        method: 'meta',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha de conexão com a API da Meta.',
      method: 'meta',
    };
  }
}

/**
 * Open WhatsApp directly (Web or App) as 1-click fallback
 */
export function openWhatsAppDirectly(phone: string, text: string): void {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(text);
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
