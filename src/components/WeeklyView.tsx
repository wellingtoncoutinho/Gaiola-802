import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { ROOMMATES, LOAD_TYPES } from '../constants/roommates';
import { Reservation } from '../types';

interface WeeklyViewProps {
  currentWeekStart: Date;
  onChangeWeek: (newStart: Date) => void;
  reservations: Reservation[];
  onSelectDate: (date: Date) => void;
  onSelectReservation: (reservation: Reservation) => void;
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({
  currentWeekStart,
  onChangeWeek,
  reservations,
  onSelectDate,
  onSelectReservation,
}) => {
  // Generate 7 days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    onChangeWeek(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    onChangeWeek(d);
  };

  const handleCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = (dayOfWeek + 6) % 7; // Monday as day 0
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    onChangeWeek(monday);
  };

  const todayStr = new Date().toDateString();

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
      {/* Weekly Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Visão Semanal
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
            {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} –{' '}
            {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            onClick={handlePrevWeek}
            className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleCurrentWeek}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Esta semana
          </button>
          <button
            onClick={handleNextWeek}
            className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Próxima semana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 7 Days Columns */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mt-4">
        {weekDays.map((day) => {
          const isToday = day.toDateString() === todayStr;
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);

          const dayBookings = reservations.filter((r) => {
            const start = new Date(r.startTime).getTime();
            return start >= dayStart.getTime() && start <= dayEnd.getTime();
          });

          return (
            <div
              key={day.toISOString()}
              className={`rounded-xl border p-3 flex flex-col min-h-[190px] transition-all ${
                isToday
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50/70 dark:bg-zinc-800/40 shadow-xs'
                  : 'border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/40'
              }`}
            >
              {/* Day title & link */}
              <div
                onClick={() => onSelectDate(day)}
                className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer group"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {day.getDate()}
                  </div>
                </div>

                {isToday && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF9C3] text-[#854D0E]">
                    Hoje
                  </span>
                )}
              </div>

              {/* Day reservations list */}
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {dayBookings.length === 0 ? (
                  <div
                    onClick={() => onSelectDate(day)}
                    className="h-full flex items-center justify-center text-[11px] text-zinc-300 dark:text-zinc-600 cursor-pointer hover:text-zinc-500 transition-colors py-4 text-center"
                  >
                    Livre
                  </div>
                ) : (
                  dayBookings.map((b) => {
                    const morador = ROOMMATES.find((m) => m.id === b.moradorId) || ROOMMATES[0];
                    const startFmt = new Date(b.startTime).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const load = LOAD_TYPES.find((t) => t.id === b.loadTypeId);

                    return (
                      <div
                        key={b.id}
                        onClick={() => onSelectReservation(b)}
                        className="p-2 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs"
                        style={{
                          backgroundColor: `${morador.color.hex}14`,
                          borderColor: `${morador.color.hex}40`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-[11px] font-bold truncate"
                            style={{ color: morador.color.hex }}
                          >
                            {morador.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                            {startFmt}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                          {b.assignedRacks.length === 0
                            ? 'Apenas Máquina'
                            : b.assignedRacks.length === 2
                            ? 'Varal 1 + 2'
                            : b.assignedRacks[0] === 'rack_1'
                            ? 'Varal 1'
                            : 'Varal 2'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
