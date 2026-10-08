import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Wind, Shirt, Zap, Bed, Sparkles, Wrench, ChevronDown, ArrowRight, Check, Droplets, Sun, Cloud, CloudRain } from 'lucide-react';
import { LOAD_TYPES, ROOMMATES, BUFFER_HANG_MINUTES, BUFFER_COLLECT_MINUTES } from '../constants/roommates';
import { LoadTypeId, MoradorId, Reservation, WeatherData } from '../types';
import {
  calculateScheduleTimings,
  validateBookingConflicts,
  getAvailableRacksForTime,
} from '../services/dryingEngine';
import { GaiolaLogo } from './GaiolaLogo';

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: Reservation) => void;
  activeMoradorId: MoradorId;
  existingReservations: Reservation[];
  weather: WeatherData | null;
  initialDate?: Date;
}

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  activeMoradorId,
  existingReservations,
  weather,
  initialDate,
}) => {
  // Morador selection (defaults to active morador)
  const [moradorId, setMoradorId] = useState<MoradorId>(activeMoradorId);

  // Load type selection
  const [loadTypeId, setLoadTypeId] = useState<LoadTypeId>('dia_a_dia');
  const [showMaintenance, setShowMaintenance] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Date and Time (default to today rounded to next 30 or next hour)
  const defaultDateTime = useMemo(() => {
    const base = initialDate ? new Date(initialDate) : new Date();
    // round up to next 15 minutes
    const remainder = base.getMinutes() % 15;
    if (remainder > 0) {
      base.setMinutes(base.getMinutes() + (15 - remainder));
    }
    base.setSeconds(0, 0);
    return base;
  }, [initialDate]);

  const [dateStr, setDateStr] = useState<string>(() => {
    const d = defaultDateTime;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const [timeStr, setTimeStr] = useState<string>(() => {
    const d = defaultDateTime;
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  });

  // Target racks selection (user can choose rack_1, rack_2, both, or none)
  const [selectedRacks, setSelectedRacks] = useState<('rack_1' | 'rack_2')[]>(['rack_1']);

  // Notes
  const [notes, setNotes] = useState('');

  // Sync activeMoradorId if prop changes
  useEffect(() => {
    setMoradorId(activeMoradorId);
  }, [activeMoradorId]);

  // Current selected load configuration
  const currentLoad = useMemo(() => {
    return LOAD_TYPES.find((t) => t.id === loadTypeId) || LOAD_TYPES[1];
  }, [loadTypeId]);

  // When changing load type, set smart initial racks suggestion (user can still freely toggle!)
  const handleSelectLoadType = (newId: LoadTypeId) => {
    setLoadTypeId(newId);
    if (newId === 'limpeza_maquina') {
      setSelectedRacks([]);
    } else if (newId === 'cama_edredom') {
      // Suggest both racks for cama/edredom, but user can change anytime
      setSelectedRacks(['rack_1', 'rack_2']);
    } else if (selectedRacks.length === 0) {
      setSelectedRacks(['rack_1']);
    }
  };

  // Target Date object
  const targetStartTime = useMemo(() => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour || 0, min || 0, 0, 0);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [dateStr, timeStr]);

  // Schedule timings with dynamic Copacabana weather impact (temp, humidity, wind, clouds)
  const timings = useMemo(() => {
    const calc = calculateScheduleTimings(targetStartTime, loadTypeId, weather, selectedRacks);
    if (selectedRacks.length === 0) {
      return {
        ...calc,
        hangDeadline: calc.machineEndTime,
        dryEndTime: calc.machineEndTime,
        rackReleaseTime: calc.machineEndTime,
        calculatedDryingMinutes: 0,
      };
    }
    return calc;
  }, [targetStartTime, loadTypeId, weather, selectedRacks]);

  // Check rack availability for auto-suggestion
  const availableRacks = useMemo(() => {
    return getAvailableRacksForTime(
      timings.machineEndTime,
      timings.rackReleaseTime,
      existingReservations
    );
  }, [timings, existingReservations]);

  // Toggle rack selection handler
  const handleToggleRack = (rack: 'rack_1' | 'rack_2') => {
    setSelectedRacks((prev) => {
      if (prev.includes(rack)) {
        return prev.filter((r) => r !== rack);
      } else {
        return [...prev, rack].sort();
      }
    });
  };

  // Conflict verification
  const conflict = useMemo(() => {
    return validateBookingConflicts(
      targetStartTime,
      loadTypeId,
      selectedRacks,
      existingReservations,
      undefined,
      weather
    );
  }, [targetStartTime, loadTypeId, selectedRacks, existingReservations, weather]);

  if (!isOpen) return null;

  const handleApplySuggestion = () => {
    if (conflict.suggestedStartTime) {
      const suggested = new Date(conflict.suggestedStartTime);
      const y = suggested.getFullYear();
      const m = String(suggested.getMonth() + 1).padStart(2, '0');
      const d = String(suggested.getDate()).padStart(2, '0');
      setDateStr(`${y}-${m}-${d}`);

      const h = String(suggested.getHours()).padStart(2, '0');
      const min = String(suggested.getMinutes()).padStart(2, '0');
      setTimeStr(`${h}:${min}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conflict.hasConflict) return;

    const newReservation: Reservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      moradorId,
      loadTypeId,
      startTime: timings.startTime.toISOString(),
      machineEndTime: timings.machineEndTime.toISOString(),
      hangDeadline: timings.hangDeadline.toISOString(),
      dryEndTime: timings.dryEndTime.toISOString(),
      rackReleaseTime: timings.rackReleaseTime.toISOString(),
      assignedRacks: selectedRacks,
      weatherFactor: timings.weatherFactor,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onSave(newReservation);
    onClose();
  };

  const regularLoads = LOAD_TYPES.filter((t) => !t.isMaintenance);
  const maintenanceLoads = LOAD_TYPES.filter((t) => t.isMaintenance);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 touch-none modal-backdrop-lock overscroll-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Fixed at top, always visible and reachable */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1B2A4A] text-[#FEF9C3] flex items-center justify-center p-1 shrink-0 shadow-xs">
              <GaiolaLogo className="w-full h-full" showChain={false} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Apê 802 · Copacabana
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-none mt-0.5">
                Nova Reserva de Lavanderia
              </h3>
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
          <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y modal-vertical-only overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5 w-full min-w-0">
            {/* 1. Quem vai lavar? */}
            <div className="w-full min-w-0">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Quem vai lavar?
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full min-w-0">
              {ROOMMATES.map((m) => {
                const isSelected = m.id === moradorId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMoradorId(m.id)}
                    className={`py-2 px-0.5 sm:px-1 rounded-xl border text-center transition-all min-w-0 w-full overflow-hidden ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 shadow-xs'
                        : 'border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg mx-auto flex items-center justify-center text-[10px] font-bold text-white mb-1 shadow-2xs shrink-0"
                      style={{ backgroundColor: m.color.hex }}
                    >
                      {m.avatarInitials}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate w-full px-0.5">
                      {m.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Tipo de Carga */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Tipo de Carga & Ciclo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {regularLoads.map((type) => {
                const isSelected = type.id === loadTypeId;
                const hours = Math.floor(type.cycleMinutes / 60);
                const mins = type.cycleMinutes % 60;
                const durationLabel = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleSelectLoadType(type.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#1B2A4A] dark:border-zinc-200 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs ring-1 ring-[#1B2A4A]/20'
                        : 'border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {type.name}
                      </span>
                      {type.racksNeeded === 2 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          2 Varais
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                      {type.description}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                      <span>Ciclo: {durationLabel}</span>
                      <span>·</span>
                      <span>Secagem base: {type.baseDryingHours}h</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Opções discretas / disfarçadas de manutenção & faxina */}
            <div className="mt-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowMaintenance(!showMaintenance)}
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium transition-colors cursor-pointer py-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>Outros ciclos (panos de chão, limpeza da máquina)</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showMaintenance ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {(showMaintenance || currentLoad.isMaintenance) && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 animate-in fade-in duration-150">
                  {maintenanceLoads.map((type) => {
                    const isSelected = type.id === loadTypeId;
                    const hours = Math.floor(type.cycleMinutes / 60);
                    const mins = type.cycleMinutes % 60;
                    const durationLabel = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;

                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          handleSelectLoadType(type.id);
                          setShowMaintenance(true);
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-[#1B2A4A] dark:border-zinc-200 bg-white dark:bg-zinc-800 shadow-xs'
                            : 'border-zinc-200/50 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            {type.id === 'limpeza_maquina' ? (
                              <Wrench className="w-3.5 h-3.5 text-sky-500" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            )}
                            {type.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                            {durationLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {type.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Data & Horário de Início */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Data do Início
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#1B2A4A]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Horário da Máquina
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#1B2A4A]/30 font-mono"
                required
              />
            </div>
          </div>

          {/* 4. Escolha dos Varais de Secagem (1, 2, ambos ou nenhum) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Varais de Secagem
                </label>
                <span className="text-[11px] text-zinc-400 ml-1.5 font-normal">
                  (Selecione 1, 2 ou ambos)
                </span>
              </div>

              {/* Atalhos Rápidos */}
              <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedRacks(['rack_1'])}
                  className={`px-2 py-0.5 rounded-lg border transition-colors ${
                    selectedRacks.length === 1 && selectedRacks.includes('rack_1')
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold shadow-2xs'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  Só Varal 1
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRacks(['rack_2'])}
                  className={`px-2 py-0.5 rounded-lg border transition-colors ${
                    selectedRacks.length === 1 && selectedRacks.includes('rack_2')
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold shadow-2xs'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  Só Varal 2
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRacks(['rack_1', 'rack_2'])}
                  className={`px-2 py-0.5 rounded-lg border transition-colors ${
                    selectedRacks.length === 2
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold shadow-2xs'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  Ambos (1 e 2)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRacks([])}
                  className={`px-2 py-0.5 rounded-lg border transition-colors ${
                    selectedRacks.length === 0
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-semibold shadow-2xs'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  Nenhum
                </button>
              </div>
            </div>

            {/* Cartões Interativos para Varal 1 e Varal 2 */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
              {/* Varal 1 */}
              <button
                type="button"
                onClick={() => handleToggleRack('rack_1')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRacks.includes('rack_1')
                    ? 'border-[#1B2A4A] dark:border-zinc-100 bg-white dark:bg-zinc-800 shadow-xs ring-2 ring-[#1B2A4A]/20 dark:ring-zinc-100/20'
                    : 'border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        selectedRacks.includes('rack_1')
                          ? 'bg-[#1B2A4A] dark:bg-zinc-100 border-transparent text-[#FEF9C3] dark:text-zinc-900'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {selectedRacks.includes('rack_1') && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Varal 1
                    </span>
                  </div>
                  {availableRacks.rack_1 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Livre
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Ocupado
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1.5 pl-6 line-clamp-1">
                  Varal da janela (mais vento)
                </p>
              </button>

              {/* Varal 2 */}
              <button
                type="button"
                onClick={() => handleToggleRack('rack_2')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRacks.includes('rack_2')
                    ? 'border-[#1B2A4A] dark:border-zinc-100 bg-white dark:bg-zinc-800 shadow-xs ring-2 ring-[#1B2A4A]/20 dark:ring-zinc-100/20'
                    : 'border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        selectedRacks.includes('rack_2')
                          ? 'bg-[#1B2A4A] dark:bg-zinc-100 border-transparent text-[#FEF9C3] dark:text-zinc-900'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {selectedRacks.includes('rack_2') && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Varal 2
                    </span>
                  </div>
                  {availableRacks.rack_2 ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Livre
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Ocupado
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-1.5 pl-6 line-clamp-1">
                  Varal interno da área
                </p>
              </button>
            </div>

            {/* Aviso contextual do resumo de varais */}
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-1">
              <span>
                {selectedRacks.length === 2
                  ? '✓ Ambos os varais (1 e 2) serão reservados para sua carga.'
                  : selectedRacks.length === 1
                  ? `✓ Apenas o ${selectedRacks[0] === 'rack_1' ? 'Varal 1' : 'Varal 2'} será reservado.`
                  : '✓ Nenhum varal será reservado (apenas a máquina de lavar).'}
              </span>
              {loadTypeId === 'cama_edredom' && selectedRacks.length === 1 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  (1 varal selecionado para cama/edredom)
                </span>
              )}
            </div>
          </div>

          {/* 5. Previsão do Clima & Cálculo Dinâmico de Secagem */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 p-4 space-y-3 text-xs">
            {/* Header da Previsão */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Previsão em Copacabana ao estender no varal</span>
                <span className="text-[11px] font-mono text-zinc-400 font-normal">
                  (~{timings.hangDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                </span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Em tempo real
              </span>
            </div>

            {/* 4 Mini Cards de Métricas Climáticas da Hora */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Temperatura */}
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Temperatura</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {timings.weatherFactor.temperature}°C
                </div>
                <div className="text-[9px] text-zinc-400">
                  {timings.weatherFactor.temperature >= 28 ? 'Calor do Rio' : 'Ameno'}
                </div>
              </div>

              {/* Umidade Relativa */}
              <div className={`p-2 rounded-lg border ${
                timings.weatherFactor.humidity >= 80
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                  : 'bg-white dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700/60'
              }`}>
                <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-500" />
                  <span>Umidade</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {timings.weatherFactor.humidity}%
                </div>
                <div className={`text-[9px] font-medium ${
                  timings.weatherFactor.humidity >= 80
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-zinc-400'
                }`}>
                  {timings.weatherFactor.humidity >= 85
                    ? 'Alta umidade'
                    : timings.weatherFactor.humidity <= 60
                    ? 'Ar seco'
                    : 'Normal'}
                </div>
              </div>

              {/* Vento de Copacabana */}
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                  <Wind className="w-3 h-3 text-teal-500" />
                  <span>Vento</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                  {timings.weatherFactor.windSpeed} km/h
                </div>
                <div className={`text-[9px] font-medium ${
                  timings.weatherFactor.windSpeed >= 16
                    ? 'text-teal-600 dark:text-teal-400 font-semibold'
                    : timings.weatherFactor.windSpeed < 7
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-zinc-400'
                }`}>
                  {timings.weatherFactor.windSpeed >= 20
                    ? 'Vento forte'
                    : timings.weatherFactor.windSpeed >= 12
                    ? 'Brisa do mar'
                    : 'Vento fraco'}
                </div>
              </div>

              {/* Céu / Nuvens */}
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-zinc-400" />
                  <span>Céu</span>
                </div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                  {timings.weatherFactor.conditionText}
                </div>
                <div className="text-[9px] text-zinc-400">
                  {timings.weatherFactor.cloudCover !== undefined
                    ? `${timings.weatherFactor.cloudCover}% nuvens`
                    : 'Copacabana'}
                </div>
              </div>
            </div>

            {/* Cálculo de Secagem e Comparativo */}
            {selectedRacks.length > 0 && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Secagem estimada no varal:</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-zinc-400 text-[11px] tabular-nums">
                      {currentLoad.baseDryingHours}h (base)
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
                      ~{Math.floor(timings.calculatedDryingMinutes / 60)}h
                      {timings.calculatedDryingMinutes % 60 > 0 ? `${timings.calculatedDryingMinutes % 60}m` : ''}
                    </span>
                  </div>
                </div>

                {/* Badge de Impacto */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Ajuste climático:</span>
                  <span className={`font-semibold ${
                    timings.weatherFactor.multiplier <= 0.90
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : timings.weatherFactor.multiplier >= 1.15
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {timings.weatherFactor.multiplier <= 0.90
                      ? `⚡ ${Math.round((1 - timings.weatherFactor.multiplier) * 100)}% mais rápida (calor & vento)`
                      : timings.weatherFactor.multiplier >= 1.15
                      ? `⏳ ${Math.round((timings.weatherFactor.multiplier - 1) * 100)}% mais lenta (umidade/pouco vento)`
                      : '✓ Ritmo regular de secagem'}
                  </span>
                </div>
              </div>
            )}

            {/* Horários Principais */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-zinc-500">
                <span>Término da Máquina (+30m tolerância):</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {timings.machineEndTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {selectedRacks.length > 0 ? (
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Varal 100% liberado (+1h tolerância):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ~{timings.rackReleaseTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {timings.rackReleaseTime.toDateString() !== targetStartTime.toDateString() && (
                      <span className="text-[10px] text-zinc-400 ml-1">
                        ({timings.rackReleaseTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Sem uso de varal (apenas máquina de lavar)
                </div>
              )}
            </div>

            {/* Dica de Vento & Varal em Copacabana */}
            {selectedRacks.length > 0 && (
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-white/70 dark:bg-zinc-800/80 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  {selectedRacks.includes('rack_1') && timings.weatherFactor.windSpeed >= 12
                    ? 'O Varal 1 (Janela) aproveita a brisa de Copacabana e acelera a evaporação!'
                    : timings.weatherFactor.humidity >= 80
                    ? `Umidade alta no litoral (${timings.weatherFactor.humidity}%): estenda as roupas bem espaçadas para circular ar.`
                    : timings.weatherFactor.windSpeed < 8
                    ? 'Pouco vento neste horário: o varal interno dependerá mais do calor do que da ventilação.'
                    : 'Condições favoráveis para secagem em Copacabana.'}
                </span>
              </div>
            )}
          </div>

          {/* 6. Conflict Notification & Smart Suggestion */}
          {conflict.hasConflict && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Conflito de Horário Detectado</div>
                  <div className="mt-0.5 text-rose-800 dark:text-rose-300">
                    {conflict.machineConflict?.message || conflict.rackConflict?.message}
                  </div>
                </div>
              </div>

              {conflict.suggestedStartTime && (
                <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between">
                  <span className="text-rose-700 dark:text-rose-300 text-[11px]">
                    Sugerimos iniciar a partir de:{' '}
                    <strong>
                      {new Date(conflict.suggestedStartTime).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleApplySuggestion}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1"
                  >
                    <span>Ajustar Horário</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          </div>

          {/* Modal Actions Footer - Fixed at bottom, always visible and reachable */}
          <div className="shrink-0 px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 flex items-center justify-end gap-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={conflict.hasConflict}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#1B2A4A] text-white hover:bg-[#15223c] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirmar Agendamento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
