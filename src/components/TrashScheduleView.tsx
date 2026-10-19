import React, { useState } from 'react';
import {
  Trash2,
  CheckCircle2,
  Clock,
  Phone,
  Send,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Calendar,
  Check,
  RotateCcw,
  User,
} from 'lucide-react';
import { MoradorId, ChoresState } from '../types';
import { ROOMMATES, TRASH_SCHEDULE_RULES } from '../constants/roommates';
import {
  getTrashDutyForDate,
  formatDateKey,
  confirmTrashDuty,
  unconfirmTrashDuty,
  generateTrashMessage,
  sendWhatsAppNotification,
  openWhatsAppDirectly,
} from '../services/choresService';

interface TrashScheduleViewProps {
  chores: ChoresState;
  onUpdateChores: (updated: ChoresState) => void;
  activeMoradorId: MoradorId;
  onOpenPhonesModal: () => void;
}

export const TrashScheduleView: React.FC<TrashScheduleViewProps> = ({
  chores,
  onUpdateChores,
  activeMoradorId,
  onOpenPhonesModal,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const today = new Date();
  const duty = getTrashDutyForDate(selectedDate, chores);
  const todayDuty = getTrashDutyForDate(today, chores);

  const activeMorador = ROOMMATES.find((m) => m.id === activeMoradorId) || ROOMMATES[0];

  const handleConfirm = async () => {
    if (!duty.moradorId) return;
    const updated = await confirmTrashDuty(duty.dateKey, duty.moradorId, activeMorador.name);
    onUpdateChores(updated);
  };

  const handleUnconfirm = async () => {
    const updated = await unconfirmTrashDuty(duty.dateKey);
    onUpdateChores(updated);
  };

  const handleSendMetaWhatsApp = async () => {
    if (!duty.moradorId) return;
    setIsSendingWa(true);
    setWaFeedback(null);

    const { messageText } = generateTrashMessage(
      duty.moradorName,
      duty.roomName,
      duty.dateKey,
      duty.moradorId
    );

    const result = await sendWhatsAppNotification({
      toPhone: duty.phone,
      messageText,
      taskType: 'trash',
      taskId: duty.dateKey,
      moradorId: duty.moradorId,
    });

    setIsSendingWa(false);
    if (result.success) {
      setWaFeedback({
        success: true,
        message: `Mensagem enviada com sucesso para o WhatsApp de ${duty.moradorName}!`,
      });
      // reload chores state
      const updatedDuty = getTrashDutyForDate(selectedDate, chores);
    } else {
      setWaFeedback({
        success: false,
        message: result.error || 'Falha ao enviar mensagem via Meta API.',
      });
    }
  };

  const handleOpenDirectWhatsApp = () => {
    if (!duty.moradorId) return;
    const { messageText } = generateTrashMessage(
      duty.moradorName,
      duty.roomName,
      duty.dateKey,
      duty.moradorId
    );
    openWhatsAppDirectly(duty.phone, messageText);
  };

  // Get current week days (Monday to Friday)
  const currentWeekDays = React.useMemo(() => {
    const curr = new Date(selectedDate);
    const day = curr.getDay();
    const diffToMonday = (day + 6) % 7; // distance from Monday
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - diffToMonday);

    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Banner de Apresentação & Ação Rápida */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Trash2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Escala do Lixo · Gaiola 802
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Seg a Sex às 10h
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Cada quarto é responsável por retirar o lixo no seu respectivo dia da semana.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenPhonesModal}
          className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Telefones & API Meta</span>
        </button>
      </div>

      {/* Card Destaque: O Dia Selecionado / Hoje */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Escala de {duty.weekdayName}
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-2">
              <span>{selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              {formatDateKey(selectedDate) === formatDateKey(today) && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  Hoje
                </span>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {duty.isWeekend ? (
              <span className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-semibold inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Fim de Semana (Livre)
              </span>
            ) : duty.isConfirmed ? (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Lixo Retirado com Sucesso!
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-4 h-4 text-amber-500" />
                Pendente de Retirada
              </span>
            )}
          </div>
        </div>

        {/* Morador Responsável do Dia */}
        {!duty.isWeekend && duty.rule && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Responsável Card */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                  style={{
                    backgroundColor:
                      ROOMMATES.find((m) => m.id === duty.moradorId)?.color.hex || '#1B2A4A',
                  }}
                >
                  {ROOMMATES.find((m) => m.id === duty.moradorId)?.avatarInitials || 'Q'}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-400">
                    Responsável da {duty.weekdayName}:
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {duty.moradorName}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {duty.roomName}
                  </div>
                </div>
              </div>

              {/* Botão de Confirmação Rápida */}
              <div>
                {duty.isConfirmed ? (
                  <button
                    type="button"
                    onClick={handleUnconfirm}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                    title="Clique para desfazer confirmação"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Desfazer</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar Retirada</span>
                  </button>
                )}
              </div>
            </div>

            {/* Painel do WhatsApp (Meta API & Link Direto) */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Notificação no WhatsApp (10h)
                </span>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {duty.phone ? duty.phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4') : 'Sem telefone cadastrado'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Envio via Meta API */}
                <button
                  type="button"
                  onClick={handleSendMetaWhatsApp}
                  disabled={isSendingWa || !duty.phone}
                  className="flex-1 min-w-[150px] px-3.5 py-2 rounded-xl bg-[#1B2A4A] dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-[#15223c] dark:hover:bg-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingWa ? 'Enviando...' : 'Disparar via Meta API'}</span>
                </button>

                {/* Envio Direto via Link do WhatsApp */}
                <button
                  type="button"
                  onClick={handleOpenDirectWhatsApp}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Abre o WhatsApp com a mensagem pronta e o link de confirmação"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir WhatsApp</span>
                </button>
              </div>

              {/* Status do envio */}
              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span>
                  {duty.record?.whatsappSent
                    ? `✓ Notificação disparada às ${new Date(duty.record.whatsappSentAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Aviso programado automaticamente para 10h'}
                </span>
                {duty.isConfirmed && duty.confirmedAt && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Confirmado por {duty.confirmedBy || duty.moradorName} às {new Date(duty.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {waFeedback && (
                <div
                  className={`p-2 rounded-lg text-[11px] font-medium ${
                    waFeedback.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {waFeedback.message}
                </div>
              )}
            </div>
          </div>
        )}

        {duty.isWeekend && (
          <div className="p-6 text-center text-zinc-400 space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-amber-500/70" />
            <div className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">
              Fim de semana na Gaiola 802
            </div>
            <p className="text-xs max-w-md mx-auto">
              A escala por quarto funciona de segunda a sexta-feira. No fim de semana, quem encher a lixeira desce para a lixeira comum do prédio.
            </p>
          </div>
        )}
      </div>

      {/* Grade da Semana Completa (Segunda a Sexta) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Escala Semanal dos Quartos (Segunda a Sexta)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            Clique em um dia para inspecionar
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {currentWeekDays.map((dateObj) => {
            const dayDuty = getTrashDutyForDate(dateObj, chores);
            const isSelected = formatDateKey(dateObj) === formatDateKey(selectedDate);
            const isToday = formatDateKey(dateObj) === formatDateKey(today);

            return (
              <button
                key={dayDuty.dateKey}
                type="button"
                onClick={() => setSelectedDate(dateObj)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#1B2A4A] dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-800 shadow-xs ring-1 ring-[#1B2A4A]/20'
                    : 'border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
                }`}
              >
                {/* Header do dia */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {dayDuty.weekdayName.split('-')[0]}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Hoje
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>

                {/* Quarto & Morador */}
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          ROOMMATES.find((m) => m.id === dayDuty.moradorId)?.color.hex || '#999',
                      }}
                    />
                    <span className="truncate">{dayDuty.moradorName}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {dayDuty.roomName}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                  {dayDuty.isConfirmed ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Retirado
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Pendente
                    </span>
                  )}
                  {dayDuty.record?.whatsappSent && (
                    <span className="text-zinc-400" title="WhatsApp enviado">
                      📱
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Regras e Funcionamento */}
      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
        <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Como funciona a Escala do Lixo na Gaiola 802:</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong>Horário oficial:</strong> Toda segunda a sexta às 10:00 da manhã, o sistema envia a mensagem automática pelo WhatsApp com o link de confirmação para a pessoa do quarto escalado.
          </li>
          <li>
            <strong>Confirmação em 1 clique:</strong> Ao clicar no link do WhatsApp ou no botão acima, o status atualiza imediatamente para toda a casa em tempo real.
          </li>
          <li>
            <strong>Troca de dias:</strong> Se dois moradores precisarem trocar de dia, basta qualquer morador marcar a confirmação no app.
          </li>
        </ul>
      </div>
    </div>
  );
};
