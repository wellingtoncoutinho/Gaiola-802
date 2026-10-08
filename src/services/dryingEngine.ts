import {
  BUFFER_COLLECT_MINUTES,
  BUFFER_HANG_MINUTES,
  LOAD_TYPES,
  ROOMMATES,
} from '../constants/roommates';
import {
  LoadTypeId,
  MoradorId,
  Reservation,
  TimeSlotConflict,
  WeatherData,
} from '../types';
import { getForecastForTime } from './weatherService';

export interface CalculationResult {
  startTime: Date;
  machineEndTime: Date;
  hangDeadline: Date;
  dryEndTime: Date;
  rackReleaseTime: Date;
  cycleMinutes: number;
  baseDryingHours: number;
  calculatedDryingMinutes: number;
  weatherFactor: {
    temperature: number;
    humidity: number;
    weatherCode: number;
    multiplier: number;
    conditionText: string;
    impactSummary: string;
  };
}

/**
 * Computes the exact timetable based on start time, load type, and Copacabana weather forecast
 */
export function calculateScheduleTimings(
  startTime: Date,
  loadTypeId: LoadTypeId,
  weather: WeatherData | null
): CalculationResult {
  const loadConfig = LOAD_TYPES.find((t) => t.id === loadTypeId) || LOAD_TYPES[1];

  const cycleMinutes = loadConfig.cycleMinutes;
  const baseDryingMinutes = loadConfig.baseDryingHours * 60;

  const machineEndTime = new Date(startTime.getTime() + cycleMinutes * 60 * 1000);

  // If no rack is needed (e.g. Limpeza da Máquina)
  if (loadConfig.racksNeeded === 0) {
    return {
      startTime,
      machineEndTime,
      hangDeadline: machineEndTime,
      dryEndTime: machineEndTime,
      rackReleaseTime: machineEndTime,
      cycleMinutes,
      baseDryingHours: 0,
      calculatedDryingMinutes: 0,
      weatherFactor: {
        temperature: weather?.current?.temperature ?? 26,
        humidity: weather?.current?.relativeHumidity ?? 65,
        weatherCode: weather?.current?.weatherCode ?? 1,
        multiplier: 1.0,
        conditionText: 'Auto-higienização',
        impactSummary: 'Ciclo interno da lavadora • Não utiliza varal',
      },
    };
  }

  // Forecast for when clothes are actually put on rack (startTime + cycleMinutes)
  const hangTime = new Date(startTime.getTime() + cycleMinutes * 60 * 1000);
  const weatherFactor = getForecastForTime(weather, hangTime);

  // Apply climate multiplier to drying time
  const calculatedDryingMinutes = Math.round(baseDryingMinutes * weatherFactor.multiplier);

  const hangDeadline = new Date(machineEndTime.getTime() + BUFFER_HANG_MINUTES * 60 * 1000);
  const dryEndTime = new Date(hangDeadline.getTime() + calculatedDryingMinutes * 60 * 1000);
  const rackReleaseTime = new Date(dryEndTime.getTime() + BUFFER_COLLECT_MINUTES * 60 * 1000);

  return {
    startTime,
    machineEndTime,
    hangDeadline,
    dryEndTime,
    rackReleaseTime,
    cycleMinutes,
    baseDryingHours: loadConfig.baseDryingHours,
    calculatedDryingMinutes,
    weatherFactor,
  };
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap
 */
export function doIntervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

/**
 * Check for resource conflicts:
 * 1. Machine conflict: Strictly sequential, no overlapping machine cycles.
 * 2. Rack conflict: At the time clothes are placed on the rack (machineEndTime to rackReleaseTime),
 *    the chosen rack (or both racks if cama_edredom) must be free.
 */
export function validateBookingConflicts(
  newStart: Date,
  loadTypeId: LoadTypeId,
  targetRacks: ('rack_1' | 'rack_2')[],
  existingBookings: Reservation[],
  currentBookingId?: string,
  weather?: WeatherData | null
): TimeSlotConflict {
  const timings = calculateScheduleTimings(newStart, loadTypeId, weather || null);
  const activeBookings = existingBookings.filter(
    (b) => b.id !== currentBookingId && !b.isCompletedEarly
  );

  // 1. Check Machine Overlap
  for (const b of activeBookings) {
    const bMachineStart = new Date(b.startTime);
    const bMachineEnd = new Date(b.machineEndTime);

    if (doIntervalsOverlap(timings.startTime, timings.machineEndTime, bMachineStart, bMachineEnd)) {
      const owner = ROOMMATES.find((m) => m.id === b.moradorId)?.name || 'Outro morador';
      const timeFmtStart = bMachineStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const timeFmtEnd = bMachineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return {
        hasConflict: true,
        machineConflict: {
          reservation: b,
          message: `A máquina já estará em uso por ${owner} das ${timeFmtStart} às ${timeFmtEnd}.`,
        },
        suggestedStartTime: b.machineEndTime,
      };
    }
  }

  // 2. Check Drying Rack Overlap (only if racks are requested)
  if (targetRacks.length > 0) {
    for (const b of activeBookings) {
      const bRackStart = new Date(b.machineEndTime);
      const bRackEnd = new Date(b.rackReleaseTime);

      // If new booking overlaps with existing booking's rack occupancy
      if (doIntervalsOverlap(timings.machineEndTime, timings.rackReleaseTime, bRackStart, bRackEnd)) {
        // Check if they share any rack
        for (const reqRack of targetRacks) {
          if (b.assignedRacks.includes(reqRack)) {
            const owner = ROOMMATES.find((m) => m.id === b.moradorId)?.name || 'Outro morador';
            const rackName = reqRack === 'rack_1' ? 'Varal 1' : 'Varal 2';
            const releaseFmt = bRackEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const releaseDateFmt = bRackEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            return {
              hasConflict: true,
              rackConflict: {
                reservation: b,
                rackId: reqRack,
                message: `O ${rackName} já estará ocupado por ${owner} até às ${releaseFmt} (${releaseDateFmt}).`,
              },
              suggestedStartTime: b.rackReleaseTime,
            };
          }
        }
      }
    }
  }

  return {
    hasConflict: false,
  };
}

/**
 * Suggest which rack is free for a given time window, or if both are needed
 */
export function getAvailableRacksForTime(
  machineEndTime: Date,
  rackReleaseTime: Date,
  existingBookings: Reservation[],
  currentBookingId?: string
): { rack_1: boolean; rack_2: boolean } {
  const activeBookings = existingBookings.filter(
    (b) => b.id !== currentBookingId && !b.isCompletedEarly
  );

  let rack1Free = true;
  let rack2Free = true;

  for (const b of activeBookings) {
    const bStart = new Date(b.machineEndTime);
    const bEnd = new Date(b.rackReleaseTime);

    if (doIntervalsOverlap(machineEndTime, rackReleaseTime, bStart, bEnd)) {
      if (b.assignedRacks.includes('rack_1')) rack1Free = false;
      if (b.assignedRacks.includes('rack_2')) rack2Free = false;
    }
  }

  return { rack_1: rack1Free, rack_2: rack2Free };
}

/**
 * Formats a friendly WhatsApp text message for the Copacabana flat group
 */
export function generateWhatsAppMessage(
  reservation: Reservation,
  moradorName: string
): string {
  const startDate = new Date(reservation.startTime);
  const machineEnd = new Date(reservation.machineEndTime);
  const rackRelease = new Date(reservation.rackReleaseTime);

  const dateStr = startDate.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const timeStartStr = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const timeEndStr = machineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Custom message for machine cleaning
  if (reservation.loadTypeId === 'limpeza_maquina') {
    return (
      `🫧 *Gaiola 802 — Auto-limpeza da Máquina*\n\n` +
      `👤 *Morador:* ${moradorName}\n` +
      `🧼 *Ciclo de Higienização:* ${dateStr}, das ${timeStartStr} às ${timeEndStr} (1h)\n` +
      `🪁 *Varais 1 e 2:* Livres para uso de todos! ✨\n\n` +
      `_A máquina estará limpinha e liberada às ${timeEndStr}._`
    );
  }

  // Custom message for floor cloth cleaning
  if (reservation.loadTypeId === 'pano_chao') {
    const rackName = reservation.assignedRacks[0] === 'rack_1' ? 'Varal 1' : 'Varal 2';
    const releaseStr = rackRelease.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return (
      `🧹 *Gaiola 802 — Limpeza de Panos de Chão*\n\n` +
      `👤 *Morador:* ${moradorName}\n` +
      `🫧 *Máquina (rápida):* ${dateStr}, das ${timeStartStr} às ${timeEndStr} (30 min)\n` +
      `🪁 *${rackName}:* Secagem rápida prevista até às ${releaseStr}\n\n` +
      `_Panos higienizados separados!_ ✨`
    );
  }

  const releaseStr = rackRelease.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const releaseDateStr = rackRelease.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const loadConfig = LOAD_TYPES.find((t) => t.id === reservation.loadTypeId);
  const loadName = loadConfig?.name || 'Roupas';

  const racksStr =
    reservation.assignedRacks.length === 2
      ? 'Varal 1 e Varal 2 (Carga grande)'
      : reservation.assignedRacks[0] === 'rack_1'
      ? 'Varal 1'
      : 'Varal 2';

  const isSameDay =
    startDate.toDateString() === rackRelease.toDateString();
  const rackReleaseDisplay = isSameDay
    ? `por volta das ${releaseStr}`
    : `por volta das ${releaseStr} (${releaseDateStr})`;

  return (
    `🧺 *Gaiola 802 — Reserva de Lavanderia*\n\n` +
    `👤 *Morador:* ${moradorName}\n` +
    `🫧 *Máquina reservada:* ${dateStr}, das ${timeStartStr} às ${timeEndStr}\n` +
    `👕 *Carga:* ${loadName}\n` +
    `🪁 *${racksStr}:* Liberado previsto ${rackReleaseDisplay}\n` +
    `☀️ *Previsão Copacabana:* ${reservation.weatherFactor.temperature}°C • ${reservation.weatherFactor.conditionText}\n\n` +
    `_Avisarei assim que recolher as roupas do varal! Obrigado pessoal!_ ✨`
  );
}
