import React, { useState, useEffect } from 'react';
import { X, Share2, CheckCheck, Trash2, Calendar, Clock, Droplets, Sun, Wind, ExternalLink, Check } from 'lucide-react';
import { LOAD_TYPES, ROOMMATES, BUFFER_HANG_MINUTES, BUFFER_COLLECT_MINUTES } from '../constants/roommates';
import { Reservation } from '../types';
import { getReservationStatus } from '../utils/statusHelper';
import { generateWhatsAppMessage } from '../services/dryingEngine';

interface ReservationDetailModalProps {
  reservation: Reservation | null;
  onClose: () => void;
  onReleaseEarly: (id: string) => void;
  onDeleteReservation: (id: string) => void;
}

export const ReservationDetailModal: React.FC<ReservationDetailModalProps> = ({
  reservation,
  onClose,
  onReleaseEarly,
  onDeleteReservation,
}) => {
  const [copied, setCopied] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    if (!reservation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reservation, onClose]);

  if (!reservation) return null;

  const morador = ROOMMATES.find((m) => m.id === reservation.moradorId) || ROOMMATES[0];
  const load = LOAD_TYPES.find((t) => t.id === reservation.loadTypeId);
  const status = getReservationStatus(reservation);

  const start = new Date(reservation.startTime);
  const machineEnd = new Date(reservation.machineEndTime);
  const hangDeadline = new Date(reservation.hangDeadline);
  const dryEnd = new Date(reservation.dryEndTime);
  const rackRelease = reservation.isCompletedEarly && reservation.earlyReleasedAt
    ? new Date(reservation.earlyReleasedAt)
    : new Date(reservation.rackReleaseTime);

  const racksLabel =
    reservation.assignedRacks.length === 0
      ? 'Sem varal (Apenas máquina)'
      : reservation.assignedRacks.length === 2
      ? 'Varal 1 e Varal 2 (Carga Grande)'
      : reservation.assignedRacks[0] === 'rack_1'
      ? 'Varal 1 (Janela)'
      : 'Varal 2 (Interno)';

  const whatsAppMessage = generateWhatsAppMessage(reservation, morador.name);

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsAppMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleWhatsAppWeb = () => {
    const encoded = encodeURIComponent(whatsAppMessage);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const canReleaseEarly =
    reservation.assignedRacks.length > 0 &&
    !reservation.isCompletedEarly &&
    (status.status === 'washing' ||
      status.status === 'waiting_hang' ||
      status.status === 'drying' ||
      status.status === 'ready_to_collect');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 touch-none modal-backdrop-lock overscroll-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top, always reachable */}
        <div className="shrink-0 p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
              style={{ backgroundColor: morador.color.hex }}
            >
              {morador.avatarInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {morador.name}
                </h3>
                <span className="text-xs text-zinc-400">({morador.room})</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.badgeClass}`}>
                  {status.label}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{load?.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Fechar"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y modal-vertical-only overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs w-full min-w-0">
          {/* Status highlight alert if waiting to hang or ready to collect */}
          {status.status === 'waiting_hang' && (
            <div className="p-3 rounded-xl bg-[#FEF9C3] border border-[#FDE68A] text-[#854D0E] font-medium">
              🧺 A máquina já terminou de bater! Hora de estender as roupas no {racksLabel}.
            </div>
          )}

          {status.status === 'ready_to_collect' && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              ☀️ Roupas secas no varal! Lembre-se de recolher para liberar o espaço para os outros moradores.
            </div>
          )}

          {/* Stepper Timeline Breakdown */}
          <div>
            <div className="text-[11px] font-semibold uppercase text-zinc-400 mb-3 tracking-wider">
              Ciclo Completo da Lavagem
            </div>

            <div className="relative pl-6 space-y-4 border-l-2 border-zinc-200 dark:border-zinc-800 ml-2">
              {/* Step 1: Início Máquina */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white dark:border-zinc-900" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Início da Máquina de Lavar
                  </span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </div>
              </div>

              {/* Step 2: Término Máquina & Estender */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Término da Máquina (+30m de tolerância)
                  </span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {machineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Máquina liberada para o próximo morador às{' '}
                  {machineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Step 3: Secagem no Varal */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-zinc-900" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {racksLabel}
                  </span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    Até{' '}
                    {dryEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Previsão Copa: {reservation.weatherFactor.temperature}°C ({reservation.weatherFactor.impactSummary})
                </div>
              </div>

              {/* Step 4: Liberação Definitiva */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Varal Livre (+1h para recolhimento)
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ~{rackRelease.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {reservation.isCompletedEarly && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    ✓ Roupas recolhidas antecipadamente!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action: Já recolhi */}
          {canReleaseEarly && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Já tirou as roupas do varal?
                </div>
                <div className="text-[11px] text-zinc-400">
                  Avise os outros moradores liberando o espaço agora mesmo.
                </div>
              </div>
              <button
                onClick={() => {
                  onReleaseEarly(reservation.id);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Já recolhi</span>
              </button>
            </div>
          )}

          {/* WhatsApp Text Preview Box */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Aviso para o WhatsApp do Apê
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 text-[11px] font-medium transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3 h-3 text-emerald-600" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleWhatsAppWeb}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors flex items-center gap-1"
                  title="Abrir diretamente no WhatsApp"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>

            <pre className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">
              {whatsAppMessage}
            </pre>
          </div>
        </div>

        {/* Footer Actions - Fixed at bottom, always visible */}
        <div className="shrink-0 p-3.5 px-5 sm:px-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex items-center justify-between z-10">
          <button
            type="button"
            onClick={() => {
              if (confirm('Tem certeza que deseja cancelar esta reserva?')) {
                onDeleteReservation(reservation.id);
                onClose();
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Cancelar reserva</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
