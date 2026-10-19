export type MoradorId =
  | 'thaciane'
  | 'pedro'
  | 'yan'
  | 'wellington'
  | 'fabio'
  | 'lucas'
  | 'clara'
  | 'rodrigo'
  | 'bia'
  | 'gabriel';

export interface Morador {
  id: MoradorId;
  name: string;
  avatarInitials: string;
  room: string;
  phone?: string;
  color: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    hex: string;
  };
}

export type ResourceId = 'machine' | 'rack_1' | 'rack_2';

export type LoadTypeId =
  | 'leve'
  | 'dia_a_dia'
  | 'pesada'
  | 'cama_edredom'
  | 'pano_chao'
  | 'limpeza_maquina';

export interface LoadTypeConfig {
  id: LoadTypeId;
  name: string;
  category: string;
  description: string;
  cycleMinutes: number; // Duration of washing cycle
  baseDryingHours: number; // Base hours in normal weather
  racksNeeded: 0 | 1 | 2; // 0 = sem varal (limpeza de máquina), 1 = 1 varal, 2 = 2 varais
  iconName: 'shirt' | 'zap' | 'feather' | 'bed' | 'sparkles' | 'wrench';
  isMaintenance?: boolean;
  kwhConsumption?: number; // Consumo elétrico em kWh na Brastemp 12kg BWK12 (110V)
}

export type BookingStatus =
  | 'scheduled' // Waiting to start
  | 'washing' // In machine (cycle active)
  | 'waiting_hang' // Machine finished, 30 min buffer to hang
  | 'drying' // Hanging on rack(s)
  | 'ready_to_collect' // Dried, 1h collect buffer
  | 'completed'; // Done or released early

export interface Reservation {
  id: string;
  moradorId: MoradorId;
  loadTypeId: LoadTypeId;
  startTime: string; // ISO string
  machineEndTime: string; // ISO string (startTime + cycleMinutes)
  hangDeadline: string; // ISO string (machineEndTime + 30 min buffer)
  dryEndTime: string; // ISO string (hangDeadline + calculatedDryingMinutes)
  rackReleaseTime: string; // ISO string (dryEndTime + 60 min buffer)
  
  assignedRacks: ('rack_1' | 'rack_2')[]; // rack_1, rack_2, or both
  
  weatherFactor: {
    temperature: number;
    humidity: number;
    weatherCode: number;
    windSpeed?: number;
    cloudCover?: number;
    multiplier: number;
    conditionText: string;
    impactSummary: string;
    windSummary?: string;
    humiditySummary?: string;
  };

  isCompletedEarly?: boolean;
  earlyReleasedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface WeatherData {
  current: {
    temperature: number;
    relativeHumidity: number;
    weatherCode: number;
    isDay: number;
    windSpeed: number;
    windGusts?: number;
    cloudCover: number;
    precipitationProbability?: number;
    precipitation?: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    weathercode: number[];
    wind_speed_10m: number[];
    cloud_cover: number[];
    precipitation_probability: number[];
    precipitation: number[];
  };
  dryingCondition: {
    level: 'optimal' | 'normal' | 'slow' | 'rain_risk';
    title: string;
    description: string;
    multiplier: number;
    windTip?: string;
  };
  updatedAt: string;
}

export interface TimeSlotConflict {
  hasConflict: boolean;
  machineConflict?: {
    reservation: Reservation;
    message: string;
  };
  rackConflict?: {
    reservation: Reservation;
    rackId: 'rack_1' | 'rack_2';
    message: string;
  };
  suggestedStartTime?: string;
}

// ==========================================
// ESCALA DO LIXO & LIMPEZA DA CASA TYPES
// ==========================================

export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 0; // 1=Segunda ... 5=Sexta, 6=Sábado, 0=Domingo

export interface TrashDutyRule {
  weekday: 1 | 2 | 3 | 4 | 5; // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex
  weekdayName: string;
  room: string;
  defaultMoradorId: MoradorId;
}

export interface TrashDutyRecord {
  date: string; // YYYY-MM-DD
  moradorId: MoradorId;
  room: string;
  confirmed: boolean;
  confirmedAt?: string; // ISO date string
  confirmedBy?: string; // Name
  whatsappSent?: boolean;
  whatsappSentAt?: string;
}

export interface CleaningWeekDuty {
  weekId: string; // e.g. "2026-W43"
  weekNumber: number;
  year: number;
  startDate: string; // YYYY-MM-DD (Monday)
  fridayDate: string; // YYYY-MM-DD (Friday reminder)
  endDate: string; // YYYY-MM-DD (Sunday)
  moradorId: MoradorId;
  room: string;
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  notes?: string;
  whatsappSent?: boolean;
  whatsappSentAt?: string;
}

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  templateName?: string;
  testMode?: boolean;
}

export interface ChoresState {
  phones: Record<MoradorId, string>;
  trashRecords: Record<string, TrashDutyRecord>; // key: YYYY-MM-DD
  cleaningRecords: Record<string, CleaningWeekDuty>; // key: weekId
  metaConfig: MetaWhatsAppConfig;
  rotationOffset: number;
  updatedAt: string;
}

