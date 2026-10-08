import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';
import { LOAD_TYPES, ROOMMATES } from '../constants/roommates';
import { Reservation } from '../types';
import { getReservationStatus } from '../utils/statusHelper';

interface DailyTimelineProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  reservations: Reservation[];
  onSelectReservation: (reservation: Reservation) => void;
  onQuickBookAtTime?: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 06:00 to 24:00 (18 hours + midnight)

export const DailyTimeline: React.FC<DailyTimelineProps> = ({
  selectedDate,
  onSelectDate,
  reservations,
  onSelectReservation,
  onQuickBookAtTime,
}) => {
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onSelectDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onSelectDate(d);
  };

  const handleToday = () => {
    onSelectDate(new Date());
  };

  // Day range: from 06:00:00 to 24:00:00
  const dayStart = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(6, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const dayEnd = useMemo(() => {
    const d = new Date(selectedDate);
    d.setHours(24, 0, 0, 0);
    return d;
  }, [selectedDate]);

  const totalMinutesInView = 18 * 60; // 06:00 to 24:00 = 1080 min

  // Filter reservations relevant to this day
  const relevantBookings = useMemo(() => {
    return reservations.filter((r) => {
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.rackReleaseTime).getTime();
      return start < dayEnd.getTime() && end > dayStart.getTime();
    });
  }, [reservations, dayStart, dayEnd]);

  // Current time marker position percentage
  const now = new Date();
  const currentMinutesFromStart =
    (now.getTime() - dayStart.getTime()) / (60 * 1000);
  const showCurrentTimeMarker =
    isToday && currentMinutesFromStart >= 0 && currentMinutesFromStart <= totalMinutesInView;
  const currentTimePercentage = (currentMinutesFromStart / totalMinutesInView) * 100;

  // Helper to compute horizontal left and width percentage
  const getBlockStyle = (start: Date, end: Date) => {
    const startMin = Math.max(0, (start.getTime() - dayStart.getTime()) / (60 * 1000));
    const endMin = Math.min(totalMinutesInView, (end.getTime() - dayStart.getTime()) / (60 * 1000));
    const widthMin = Math.max(20, endMin - startMin);

    const left = (startMin / totalMinutesInView) * 100;
    const width = (widthMin / totalMinutesInView) * 100;

    return {
      left: `${left}%`,
      width: `${Math.min(100 - left, width)}%`,
    };
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
      {/* Date Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Linha do Tempo
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 capitalize">
              {selectedDate.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}
            </h2>
            {isToday && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF9C3] text-[#854D0E]">
                Hoje
              </span>
            )}
          </div>
        </div>

        {/* Date Navigation Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Dia anterior"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
              isToday
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Próximo dia"
            aria-label="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline Grid Container with Horizontal Scroll on Mobile */}
      <div className="relative mt-4 overflow-x-auto select-none pb-2">
        <div className="min-w-[760px] relative">
          {/* Hour Markers Bar */}
          <div className="flex ml-28 border-b border-zinc-200/80 dark:border-zinc-800 pb-2 text-[11px] font-mono tabular-nums text-zinc-400">
            {HOURS.map((hour, idx) => (
              <div
                key={hour}
                className="flex-1 text-left relative pl-1 border-l border-zinc-200/40 dark:border-zinc-800/60"
              >
                <span>{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Current Time Indicator Vertical Red Line */}
          {showCurrentTimeMarker && (
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
              style={{ left: `calc(7rem + ${currentTimePercentage}%)` }}
            >
              <div className="bg-rose-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-xs tracking-tighter shadow-xs">
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="w-[1.5px] h-full bg-rose-500/80 shadow-xs" />
            </div>
          )}

          {/* Lane 1: Máquina de Lavar */}
          <div className="flex items-center min-h-[76px] py-2 border-b border-zinc-100 dark:border-zinc-800/80 group">
            <div className="w-28 shrink-0 pr-3">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Máquina
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">1 unidade</div>
            </div>

            {/* Interactive Grid Area */}
            <div className="flex-1 h-14 relative bg-zinc-50/70 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
              {/* Hour vertical grid guides */}
              <div className="absolute inset-0 flex pointer-events-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-l border-zinc-200/30 dark:border-zinc-800/40 first:border-none"
                  />
                ))}
              </div>

              {/* Machine Blocks */}
              {relevantBookings.map((b) => {
                const bStart = new Date(b.startTime);
                const bMachineEnd = new Date(b.machineEndTime);
                const morador = ROOMMATES.find((m) => m.id === b.moradorId) || ROOMMATES[0];
                const status = getReservationStatus(b, now);
                const style = getBlockStyle(bStart, bMachineEnd);

                return (
                  <div
                    key={`m-${b.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation(b);
                    }}
                    style={style}
                    className="absolute top-1 bottom-1 z-10 px-2 py-1 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] hover:z-20 shadow-xs flex flex-col justify-center overflow-hidden"
                    title={`Máquina: ${morador.name} (${bStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${bMachineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                  >
                    <div
                      className="absolute inset-0 opacity-90 rounded-lg"
                      style={{ backgroundColor: morador.color.hex }}
                    />
                    <div className="relative text-white z-10 truncate text-[11px] font-semibold leading-tight flex items-center justify-between gap-1">
                      <span className="truncate">{morador.name}</span>
                      <span className="text-[9px] opacity-90 tabular-nums">
                        {bStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="relative text-white/90 z-10 text-[9px] font-medium truncate">
                      {status.shortLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lane 2: Varal 1 */}
          <div className="flex items-center min-h-[76px] py-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="w-28 shrink-0 pr-3">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Varal 1
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Secagem</div>
            </div>

            <div className="flex-1 h-14 relative bg-zinc-50/70 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
              <div className="absolute inset-0 flex pointer-events-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-l border-zinc-200/30 dark:border-zinc-800/40 first:border-none"
                  />
                ))}
              </div>

              {relevantBookings
                .filter((b) => b.assignedRacks.includes('rack_1'))
                .map((b) => {
                  const bRackStart = new Date(b.machineEndTime);
                  const bRackEnd = b.isCompletedEarly && b.earlyReleasedAt
                    ? new Date(b.earlyReleasedAt)
                    : new Date(b.rackReleaseTime);

                  const morador = ROOMMATES.find((m) => m.id === b.moradorId) || ROOMMATES[0];
                  const status = getReservationStatus(b, now);
                  const style = getBlockStyle(bRackStart, bRackEnd);

                  return (
                    <div
                      key={`v1-${b.id}`}
                      onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation(b);
                    }}
                      style={style}
                      className="absolute top-1 bottom-1 z-10 px-2 py-1 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] hover:z-20 shadow-xs flex flex-col justify-center overflow-hidden"
                      title={`Varal 1: ${morador.name} (Até ${bRackEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                    >
                      <div
                        className="absolute inset-0 opacity-80 rounded-lg"
                        style={{ backgroundColor: morador.color.hex }}
                      />
                      <div className="relative text-white z-10 truncate text-[11px] font-semibold leading-tight flex items-center justify-between gap-1">
                        <span className="truncate">{morador.name}</span>
                        <span className="text-[9px] opacity-90 tabular-nums">
                          {status.shortLabel}
                        </span>
                      </div>
                      <div className="relative text-white/90 z-10 text-[9px] font-mono truncate">
                        até {bRackEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Lane 3: Varal 2 */}
          <div className="flex items-center min-h-[76px] py-2">
            <div className="w-28 shrink-0 pr-3">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Varal 2
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Secagem</div>
            </div>

            <div className="flex-1 h-14 relative bg-zinc-50/70 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800/60 overflow-hidden">
              <div className="absolute inset-0 flex pointer-events-none">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 border-l border-zinc-200/30 dark:border-zinc-800/40 first:border-none"
                  />
                ))}
              </div>

              {relevantBookings
                .filter((b) => b.assignedRacks.includes('rack_2'))
                .map((b) => {
                  const bRackStart = new Date(b.machineEndTime);
                  const bRackEnd = b.isCompletedEarly && b.earlyReleasedAt
                    ? new Date(b.earlyReleasedAt)
                    : new Date(b.rackReleaseTime);

                  const morador = ROOMMATES.find((m) => m.id === b.moradorId) || ROOMMATES[0];
                  const status = getReservationStatus(b, now);
                  const style = getBlockStyle(bRackStart, bRackEnd);

                  return (
                    <div
                      key={`v2-${b.id}`}
                      onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation(b);
                    }}
                      style={style}
                      className="absolute top-1 bottom-1 z-10 px-2 py-1 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] hover:z-20 shadow-xs flex flex-col justify-center overflow-hidden"
                      title={`Varal 2: ${morador.name} (Até ${bRackEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
                    >
                      <div
                        className="absolute inset-0 opacity-80 rounded-lg"
                        style={{ backgroundColor: morador.color.hex }}
                      />
                      <div className="relative text-white z-10 truncate text-[11px] font-semibold leading-tight flex items-center justify-between gap-1">
                        <span className="truncate">{morador.name}</span>
                        <span className="text-[9px] opacity-90 tabular-nums">
                          {status.shortLabel}
                        </span>
                      </div>
                      <div className="relative text-white/90 z-10 text-[9px] font-mono truncate">
                        até {bRackEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & quick helper */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-zinc-400">Moradores:</span>
          {ROOMMATES.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: m.color.hex }}
              />
              <span className="text-zinc-700 dark:text-zinc-300">{m.name}</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Toque em qualquer reserva para ver detalhes ou liberar varal</span>
        </div>
      </div>
    </div>
  );
};
