import { BookingStatus, Reservation } from '../types';

export interface StatusInfo {
  status: BookingStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
  description: string;
  isMachineOccupied: boolean;
  isRackOccupied: boolean;
}

export function getReservationStatus(
  reservation: Reservation,
  referenceTime: Date = new Date()
): StatusInfo {
  if (reservation.isCompletedEarly) {
    return {
      status: 'completed',
      label: 'Liberado antecipadamente',
      shortLabel: 'Liberado',
      badgeClass: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
      description: 'Roupas já recolhidas e varal liberado.',
      isMachineOccupied: false,
      isRackOccupied: false,
    };
  }

  const now = referenceTime.getTime();
  const start = new Date(reservation.startTime).getTime();
  const machineEnd = new Date(reservation.machineEndTime).getTime();
  const hangDeadline = new Date(reservation.hangDeadline).getTime();
  const dryEnd = new Date(reservation.dryEndTime).getTime();
  const rackRelease = new Date(reservation.rackReleaseTime).getTime();

  if (now < start) {
    return {
      status: 'scheduled',
      label: 'Agendado',
      shortLabel: 'Agendado',
      badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      description: 'Aguardando o horário de início.',
      isMachineOccupied: false,
      isRackOccupied: false,
    };
  }

  if (now >= start && now < machineEnd) {
    return {
      status: 'washing',
      label: 'Em lavagem (Máquina)',
      shortLabel: 'Lavando',
      badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 border-blue-300 dark:border-blue-700 font-semibold',
      description: 'Máquina batendo roupa.',
      isMachineOccupied: true,
      isRackOccupied: true, // Reserved for this cycle
    };
  }

  if (now >= machineEnd && now < hangDeadline) {
    return {
      status: 'waiting_hang',
      label: 'Aguardando estender',
      shortLabel: 'Estender',
      badgeClass: 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE68A] font-semibold animate-pulse',
      description: 'Ciclo terminou! No tempo de tolerância para colocar no varal.',
      isMachineOccupied: false,
      isRackOccupied: true,
    };
  }

  if (now >= hangDeadline && now < dryEnd) {
    return {
      status: 'drying',
      label: 'Secando no Varal',
      shortLabel: 'Secando',
      badgeClass: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border-amber-200 dark:border-amber-800',
      description: 'Roupas estendidas secando ao vento de Copa.',
      isMachineOccupied: false,
      isRackOccupied: true,
    };
  }

  if (now >= dryEnd && now < rackRelease) {
    return {
      status: 'ready_to_collect',
      label: 'Pronto para recolher',
      shortLabel: 'Recolher',
      badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-semibold',
      description: 'Roupas secas! No prazo de tolerância para desocupar o varal.',
      isMachineOccupied: false,
      isRackOccupied: true,
    };
  }

  // now >= rackRelease
  return {
    status: 'completed',
    label: 'Concluído e Liberado',
    shortLabel: 'Liberado',
    badgeClass: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    description: 'Prazo concluído e recursos liberados.',
    isMachineOccupied: false,
    isRackOccupied: false,
  };
}
