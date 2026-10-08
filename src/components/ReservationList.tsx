import React, { useState } from 'react';
import { Share2, CheckCheck, Trash2, Calendar, Clock, Sparkles, Filter, Droplets } from 'lucide-react';
import { LOAD_TYPES, ROOMMATES } from '../constants/roommates';
import { MoradorId, Reservation } from '../types';
import { getReservationStatus } from '../utils/statusHelper';
import { generateWhatsAppMessage } from '../services/dryingEngine';

interface ReservationListProps {
  reservations: Reservation[];
  onSelectReservation: (res: Reservation) => void;
  onReleaseEarly: (id: string) => void;
  onDeleteReservation: (id: string) => void;
  activeMoradorId: MoradorId;
}

export const ReservationList: React.FC<ReservationListProps> = ({
  reservations,
  onSelectReservation,
  onReleaseEarly,
  onDeleteReservation,
  activeMoradorId,
}) => {
  const [filterMorador, setFilterMorador] = useState<MoradorId | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = reservations
    .filter((r) => (filterMorador === 'all' ? true : r.moradorId === filterMorador))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const handleCopyWhatsApp = (res: Reservation, e: React.MouseEvent) => {
    e.stopPropagation();
    const morador = ROOMMATES.find((m) => m.id === res.moradorId)?.name || 'Morador';
    const msg = generateWhatsAppMessage(res, morador);

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(res.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleRelease = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onReleaseEarly(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja realmente cancelar esta reserva?')) {
      onDeleteReservation(id);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Agenda Completa
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
            Reservas & Histórico ({filtered.length})
          </h2>
        </div>

        {/* Roommate Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterMorador('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 ${
              filterMorador === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Todos
          </button>
          {ROOMMATES.map((m) => (
            <button
              key={m.id}
              onClick={() => setFilterMorador(m.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                filterMorador === m.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.color.hex }}
              />
              <span>{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reservation Cards */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 mt-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            Nenhuma reserva encontrada para este filtro.
          </div>
        ) : (
          filtered.map((res) => {
            const morador = ROOMMATES.find((m) => m.id === res.moradorId) || ROOMMATES[0];
            const load = LOAD_TYPES.find((t) => t.id === res.loadTypeId);
            const status = getReservationStatus(res);

            const startDate = new Date(res.startTime);
            const machineEnd = new Date(res.machineEndTime);
            const rackRelease = res.isCompletedEarly && res.earlyReleasedAt
              ? new Date(res.earlyReleasedAt)
              : new Date(res.rackReleaseTime);

            const racksLabel =
              res.assignedRacks.length === 0
                ? 'Sem varal (Apenas máquina)'
                : res.assignedRacks.length === 2
                ? 'Varal 1 e 2'
                : res.assignedRacks[0] === 'rack_1'
                ? 'Varal 1'
                : 'Varal 2';

            const canReleaseEarly =
              res.assignedRacks.length > 0 &&
              !res.isCompletedEarly &&
              (status.status === 'washing' ||
                status.status === 'waiting_hang' ||
                status.status === 'drying' ||
                status.status === 'ready_to_collect');

            return (
              <div
                key={res.id}
                onClick={() => onSelectReservation(res)}
                className="py-3.5 px-2 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Left side info */}
                <div className="flex items-start gap-3">
                  {/* Morador Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: morador.color.hex }}
                  >
                    {morador.avatarInitials}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {morador.name}
                      </span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">
                        {load?.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Timings row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {startDate.toLocaleDateString('pt-BR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        Máquina: {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} →{' '}
                        {machineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {racksLabel} (liberado ~{rackRelease.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </div>

                    {/* Weather preview note */}
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      Copacabana: {res.weatherFactor.impactSummary}
                    </div>
                  </div>
                </div>

                {/* Right side interactive actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {canReleaseEarly && (
                    <button
                      onClick={(e) => handleRelease(res.id, e)}
                      className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-2xs"
                      title="Liberar varal imediatamente"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Já recolhi</span>
                    </button>
                  )}

                  <button
                    onClick={(e) => handleCopyWhatsApp(res, e)}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                    title="Copiar aviso pronto para WhatsApp"
                    aria-label="Copiar aviso para WhatsApp"
                  >
                    {copiedId === res.id ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1">
                        Copiado!
                      </span>
                    ) : (
                      <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>

                  <button
                    onClick={(e) => handleDelete(res.id, e)}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-zinc-400 transition-colors"
                    title="Cancelar reserva"
                    aria-label="Cancelar reserva"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
