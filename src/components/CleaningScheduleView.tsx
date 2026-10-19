import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Phone,
  Send,
  MessageCircle,
  ExternalLink,
  RotateCcw,
  Check,
  Calendar,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';
import { MoradorId, ChoresState } from '../types';
import { ROOMMATES, CLEANING_ROTATION_ROOMS } from '../constants/roommates';
import {
  getCleaningDutyForWeek,
  getUpcomingCleaningDuties,
  confirmCleaningDuty,
  unconfirmCleaningDuty,
  generateCleaningMessage,
  sendWhatsAppNotification,
  openWhatsAppDirectly,
} from '../services/choresService';

interface CleaningScheduleViewProps {
  chores: ChoresState;
  onUpdateChores: (updated: ChoresState) => void;
  activeMoradorId: MoradorId;
  onOpenPhonesModal: () => void;
}

export const CleaningScheduleView: React.FC<CleaningScheduleViewProps> = ({
  chores,
  onUpdateChores,
  activeMoradorId,
  onOpenPhonesModal,
}) => {
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    panos: false,
    pia: false,
    lixeiras: false,
    chao: false,
  });

  const today = new Date();
  const currentWeekDuty = getCleaningDutyForWeek(today, chores);
  const upcomingWeeks = getUpcomingCleaningDuties(chores, 5);

  const activeMorador = ROOMMATES.find((m) => m.id === activeMoradorId) || ROOMMATES[0];

  const handleToggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = async () => {
    const updated = await confirmCleaningDuty(
      currentWeekDuty.weekId,
      currentWeekDuty.moradorId,
      activeMorador.name,
      'Checklist de sexta-feira preenchido'
    );
    onUpdateChores(updated);
  };

  const handleUnconfirm = async () => {
    const updated = await unconfirmCleaningDuty(currentWeekDuty.weekId);
    onUpdateChores(updated);
  };

  const handleSendMetaWhatsApp = async () => {
    setIsSendingWa(true);
    setWaFeedback(null);

    const { messageText } = generateCleaningMessage(
      currentWeekDuty.moradorName,
      currentWeekDuty.room,
      currentWeekDuty.weekId,
      currentWeekDuty.moradorId
    );

    const result = await sendWhatsAppNotification({
      toPhone: currentWeekDuty.phone,
      messageText,
      taskType: 'cleaning',
      taskId: currentWeekDuty.weekId,
      moradorId: currentWeekDuty.moradorId,
    });

    setIsSendingWa(false);
    if (result.success) {
      setWaFeedback({
        success: true,
        message: `Lembrete de sexta enviado com sucesso para ${currentWeekDuty.moradorName}!`,
      });
    } else {
      setWaFeedback({
        success: false,
        message: result.error || 'Falha ao enviar mensagem via Meta API.',
      });
    }
  };

  const handleOpenDirectWhatsApp = () => {
    const { messageText } = generateCleaningMessage(
      currentWeekDuty.moradorName,
      currentWeekDuty.room,
      currentWeekDuty.weekId,
      currentWeekDuty.moradorId
    );
    openWhatsAppDirectly(currentWeekDuty.phone, messageText);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Banner de Apresentação */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Sparkles className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Manutenção da Limpeza da Casa
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                Lembrete de Sexta
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              A limpeza pesada vem na terça ou quarta; na sexta-feira é a manutenção semanal da casa pelo quarto escalado.
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

      {/* Card Destaque: Esta Semana */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Semana Atual ({currentWeekDuty.weekId})
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-2">
              <span>
                {new Date(currentWeekDuty.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                a{' '}
                {new Date(currentWeekDuty.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                Manutenção de Sexta
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {currentWeekDuty.confirmed ? (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Manutenção Concluída!
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-4 h-4 text-amber-500" />
                Aguardando Conclusão
              </span>
            )}
          </div>
        </div>

        {/* Informações do Morador Escalado & WhatsApp */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Card do Responsável */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0"
                style={{
                  backgroundColor:
                    ROOMMATES.find((m) => m.id === currentWeekDuty.moradorId)?.color.hex || '#1B2A4A',
                }}
              >
                {ROOMMATES.find((m) => m.id === currentWeekDuty.moradorId)?.avatarInitials || 'Q'}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-zinc-400">
                  Responsável da Semana:
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {currentWeekDuty.moradorName}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {currentWeekDuty.room}
                </div>
              </div>
            </div>

            <div>
              {currentWeekDuty.confirmed ? (
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
                  <span>Já Fiz a Limpeza</span>
                </button>
              )}
            </div>
          </div>

          {/* Painel WhatsApp Sexta-Feira */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                Lembrete de Sexta-feira
              </span>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {currentWeekDuty.phone ? currentWeekDuty.phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4') : 'Sem telefone'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendMetaWhatsApp}
                disabled={isSendingWa || !currentWeekDuty.phone}
                className="flex-1 min-w-[150px] px-3.5 py-2 rounded-xl bg-[#1B2A4A] dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-[#15223c] dark:hover:bg-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingWa ? 'Enviando...' : 'Enviar Lembrete (Meta API)'}</span>
              </button>

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

            <div className="text-[11px] text-zinc-400 flex items-center justify-between">
              <span>
                {currentWeekDuty.whatsappSent
                  ? `✓ Lembrete disparado às ${new Date(currentWeekDuty.whatsappSentAt || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Disparo agendado para sexta-feira às 10h'}
              </span>
              {currentWeekDuty.confirmed && currentWeekDuty.confirmedAt && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Confirmado por {currentWeekDuty.confirmedBy || currentWeekDuty.moradorName} às{' '}
                  {new Date(currentWeekDuty.confirmedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

        {/* Checklist Rápido de Manutenção */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 space-y-3">
          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-[#1B2A4A] dark:text-[#FEF9C3]" />
            <span>Checklist da Manutenção Semanal (Sexta-feira):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <button
              type="button"
              onClick={() => handleToggleCheck('panos')}
              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/60 text-left cursor-pointer transition-colors hover:bg-zinc-50"
            >
              {checklist.panos ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <span className={checklist.panos ? 'line-through text-zinc-400' : ''}>
                Trocar e lavar panos de prato e toalhas de mão
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleCheck('pia')}
              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/60 text-left cursor-pointer transition-colors hover:bg-zinc-50"
            >
              {checklist.pia ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <span className={checklist.pia ? 'line-through text-zinc-400' : ''}>
                Checar bancadas e pia da cozinha limpas
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleCheck('lixeiras')}
              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/60 text-left cursor-pointer transition-colors hover:bg-zinc-50"
            >
              {checklist.lixeiras ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <span className={checklist.lixeiras ? 'line-through text-zinc-400' : ''}>
                Verificar lixeiras da casa e reposição de sacos
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleCheck('chao')}
              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-700/60 text-left cursor-pointer transition-colors hover:bg-zinc-50"
            >
              {checklist.chao ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <span className={checklist.chao ? 'line-through text-zinc-400' : ''}>
                Manutenção rápida do chão da sala e corredor
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Rotação das Próximas 5 Semanas */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Escala de Rotação Semanal (Próximas Semanas)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            Ordem contínua por quarto
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {upcomingWeeks.map((week, idx) => {
            const isCurrent = idx === 0;
            return (
              <div
                key={week.weekId}
                className={`p-3.5 rounded-xl border transition-all relative ${
                  isCurrent
                    ? 'border-[#1B2A4A] dark:border-zinc-200 bg-zinc-50 dark:bg-zinc-800 shadow-xs ring-1 ring-[#1B2A4A]/20'
                    : 'border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Semana {week.weekNumber}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                      Atual
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {new Date(week.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                  a{' '}
                  {new Date(week.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          ROOMMATES.find((m) => m.id === week.moradorId)?.color.hex || '#999',
                      }}
                    />
                    <span className="truncate">{week.moradorName}</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {week.room}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                  {week.confirmed ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      Concluída
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Pendente
                    </span>
                  )}
                  {week.whatsappSent && (
                    <span className="text-zinc-400" title="Lembrete enviado">
                      📱
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
