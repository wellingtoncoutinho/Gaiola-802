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
    multiplier: number;
    conditionText: string;
    impactSummary: string;
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
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    weathercode: number[];
  };
  dryingCondition: {
    level: 'optimal' | 'normal' | 'slow' | 'rain_risk';
    title: string;
    description: string;
    multiplier: number;
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
