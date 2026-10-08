import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Calendar,
  Trophy,
  TrendingDown,
  Clock,
  Wind,
  Shirt,
  Copy,
  Check,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Share2,
  Moon,
  Sun,
  Filter,
  Zap,
  SlidersHorizontal,
  Coins,
  Info,
} from 'lucide-react';
import { ROOMMATES, LOAD_TYPES } from '../constants/roommates';
import { Morador, MoradorId, Reservation } from '../types';
import { GaiolaLogo } from './GaiolaLogo';
import {
  TARIFF_FLAGS,
  DEFAULT_BASE_TARIFF_KWH,
  getReservationKwh,
  INMETRO_STANDARD_KWH,
} from '../constants/energyTariff';

interface AdminDashboardProps {
  reservations: Reservation[];
  onBackToApp: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reservations,
  onBackToApp,
  isDark,
  onToggleDark,
}) => {
  // Current month selected for reporting (defaults to current month and year)
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [filterMorador, setFilterMorador] = useState<MoradorId | 'all'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Tariff configuration state (Light S.A. Copacabana B1)
  const [baseTariff, setBaseTariff] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gaiola802_base_tariff');
      return saved ? parseFloat(saved) : DEFAULT_BASE_TARIFF_KWH;
    } catch {
      return DEFAULT_BASE_TARIFF_KWH;
    }
  });

  const [selectedFlagId, setSelectedFlagId] = useState<string>(() => {
    try {
      return localStorage.getItem('gaiola802_tariff_flag') || 'verde';
    } catch {
      return 'verde';
    }
  });

  const [isEditingTariff, setIsEditingTariff] = useState(false);
  const [tempTariffInput, setTempTariffInput] = useState(baseTariff.toString());

  const activeFlag = useMemo(() => {
    return TARIFF_FLAGS.find((f) => f.id === selectedFlagId) || TARIFF_FLAGS[0];
  }, [selectedFlagId]);

  const effectiveTariffRate = useMemo(() => {
    return Number((baseTariff + activeFlag.addition).toFixed(4));
  }, [baseTariff, activeFlag]);

  const handleUpdateBaseTariff = (val: number) => {
    const clean = Math.max(0.1, Math.min(5.0, val));
    setBaseTariff(clean);
    setTempTariffInput(clean.toString());
    try {
      localStorage.setItem('gaiola802_base_tariff', clean.toString());
    } catch {}
  };

  const handleSelectFlag = (flagId: string) => {
    setSelectedFlagId(flagId);
    try {
      localStorage.setItem('gaiola802_tariff_flag', flagId);
    } catch {}
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    setSelectedMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setSelectedMonthDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setSelectedMonthDate(d);
  };

  // Month range boundaries
  const monthStart = useMemo(() => {
    const d = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1, 0, 0, 0, 0);
    return d;
  }, [selectedMonthDate]);

  const monthEnd = useMemo(() => {
    const d = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return d;
  }, [selectedMonthDate]);

  const monthLabel = useMemo(() => {
    return selectedMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonthDate]);

  // Filter reservations for this month
  const monthReservations = useMemo(() => {
    return reservations.filter((r) => {
      const start = new Date(r.startTime).getTime();
      return start >= monthStart.getTime() && start <= monthEnd.getTime();
    });
  }, [reservations, monthStart, monthEnd]);

  // Per-roommate metrics calculation (com consumo elétrico da Brastemp 12kg BWK12)
  const roommateStats = useMemo(() => {
    const statsMap: Record<
      MoradorId,
      {
        morador: Morador;
        totalWashes: number;
        totalMachineMinutes: number;
        totalRackMinutes: number;
        rack1Minutes: number;
        rack2Minutes: number;
        earlyReleases: number;
        loadTypeCounts: Record<string, number>;
        totalKwh: number;
        totalCost: number;
      }
    > = {} as any;

    ROOMMATES.forEach((m) => {
      statsMap[m.id] = {
        morador: m,
        totalWashes: 0,
        totalMachineMinutes: 0,
        totalRackMinutes: 0,
        rack1Minutes: 0,
        rack2Minutes: 0,
        earlyReleases: 0,
        loadTypeCounts: {},
        totalKwh: 0,
        totalCost: 0,
      };
    });

    monthReservations.forEach((r) => {
      const entry = statsMap[r.moradorId];
      if (!entry) return;

      entry.totalWashes += 1;

      // Consumo elétrico em kWh do ciclo na Brastemp 12kg BWK12
      const cycleKwh = getReservationKwh(r.loadTypeId);
      entry.totalKwh += cycleKwh;

      // Machine duration
      const start = new Date(r.startTime).getTime();
      const machineEnd = new Date(r.machineEndTime).getTime();
      const machMin = Math.max(0, Math.round((machineEnd - start) / (1000 * 60)));
      entry.totalMachineMinutes += machMin;

      // Rack duration
      if (r.assignedRacks.length > 0) {
        const releaseTime =
          r.isCompletedEarly && r.earlyReleasedAt
            ? new Date(r.earlyReleasedAt).getTime()
            : new Date(r.rackReleaseTime).getTime();

        const rackMin = Math.max(0, Math.round((releaseTime - machineEnd) / (1000 * 60)));
        entry.totalRackMinutes += rackMin;

        if (r.assignedRacks.includes('rack_1')) {
          entry.rack1Minutes += rackMin;
        }
        if (r.assignedRacks.includes('rack_2')) {
          entry.rack2Minutes += rackMin;
        }
      }

      if (r.isCompletedEarly) {
        entry.earlyReleases += 1;
      }

      entry.loadTypeCounts[r.loadTypeId] = (entry.loadTypeCounts[r.loadTypeId] || 0) + 1;
    });

    return Object.values(statsMap).map((entry) => ({
      ...entry,
      totalCost: Number((entry.totalKwh * effectiveTariffRate).toFixed(2)),
    }));
  }, [monthReservations, effectiveTariffRate]);

  // Overall totals
  const totalMonthWashes = monthReservations.length;
  const totalMachineHours = useMemo(() => {
    const mins = roommateStats.reduce((acc, cur) => acc + cur.totalMachineMinutes, 0);
    return (mins / 60).toFixed(1);
  }, [roommateStats]);

  const totalRackHours = useMemo(() => {
    const mins = roommateStats.reduce((acc, cur) => acc + cur.totalRackMinutes, 0);
    return (mins / 60).toFixed(1);
  }, [roommateStats]);

  // Energy aggregates (Brastemp BWK12 12kg + Light Copacabana)
  const totalMonthKwh = useMemo(() => {
    return roommateStats.reduce((acc, cur) => acc + cur.totalKwh, 0);
  }, [roommateStats]);

  const totalMonthEnergyCost = useMemo(() => {
    return Number((totalMonthKwh * effectiveTariffRate).toFixed(2));
  }, [totalMonthKwh, effectiveTariffRate]);

  const averageCostPerWash = useMemo(() => {
    return totalMonthWashes > 0 ? Number((totalMonthEnergyCost / totalMonthWashes).toFixed(2)) : 0;
  }, [totalMonthEnergyCost, totalMonthWashes]);

  // Sorted rankings:
  // 1. Quem lavou mais (pelo menos 1 lavagem)
  const sortedByWashes = useMemo(() => {
    return [...roommateStats].sort((a, b) => b.totalWashes - a.totalWashes);
  }, [roommateStats]);

  const quemLavouMais = useMemo(() => {
    if (sortedByWashes.length === 0 || sortedByWashes[0].totalWashes === 0) return null;
    return sortedByWashes[0];
  }, [sortedByWashes]);

  // 2. Quem lavou menos
  const quemLavouMenos = useMemo(() => {
    if (sortedByWashes.length === 0) return null;
    return sortedByWashes[sortedByWashes.length - 1];
  }, [sortedByWashes]);

  // 3. Quem usou mais o varal
  const sortedByRack = useMemo(() => {
    return [...roommateStats].sort((a, b) => b.totalRackMinutes - a.totalRackMinutes);
  }, [roommateStats]);

  const quemMaisUsouVaral = useMemo(() => {
    if (sortedByRack.length === 0 || sortedByRack[0].totalRackMinutes === 0) return null;
    return sortedByRack[0];
  }, [sortedByRack]);

  // 4. Quem usou menos o varal
  const quemMenosUsouVaral = useMemo(() => {
    if (sortedByRack.length === 0) return null;
    return sortedByRack[sortedByRack.length - 1];
  }, [sortedByRack]);

  // Filtered reservations list for table
  const filteredList = useMemo(() => {
    return monthReservations
      .filter((r) => (filterMorador === 'all' ? true : r.moradorId === filterMorador))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [monthReservations, filterMorador]);

  // WhatsApp Summary Generator (com rateio de energia da lavadora Brastemp BWK12)
  const handleCopySummary = () => {
    const text = [
      `📊 *RELATÓRIO GAIOLA 802 — ${monthLabel.toUpperCase()}*`,
      `📍 Apê 802 · Copacabana, Rio de Janeiro\n`,
      `🔢 *Totais do Mês:*`,
      `• Total de lavagens: ${totalMonthWashes}`,
      `• Tempo de máquina ligada: ~${totalMachineHours}h`,
      `• Tempo de varais ocupados: ~${totalRackHours}h`,
      `• Consumo lavadora (Brastemp BWK12): ~${totalMonthKwh.toFixed(2)} kWh (*R$ ${totalMonthEnergyCost.toFixed(2)}*)\n`,
      `⚡ *Rateio da Conta de Luz (Brastemp BWK12 · Light Copacabana):*`,
      `• Tarifa aplicada: R$ ${effectiveTariffRate.toFixed(2)}/kWh (${activeFlag.name})`,
      `• Custo médio por lavagem: ~R$ ${averageCostPerWash.toFixed(2)}`,
      `• Valor por morador:`,
      ...sortedByWashes.map(
        (s) =>
          `  - ${s.morador.name}: ${s.totalWashes} lavagens | ${s.totalKwh.toFixed(2)} kWh | *R$ ${s.totalCost.toFixed(2)}*`
      ),
      `\n🏆 *Destaques do Mês:*`,
      quemLavouMais
        ? `• Quem mais lavou: *${quemLavouMais.morador.name}* (${quemLavouMais.totalWashes} lavagens)`
        : `• Quem mais lavou: Sem dados`,
      quemLavouMenos
        ? `• Quem menos lavou: *${quemLavouMenos.morador.name}* (${quemLavouMenos.totalWashes} lavagens)`
        : `• Quem menos lavou: Sem dados`,
      quemMaisUsouVaral
        ? `• Quem mais usou varal: *${quemMaisUsouVaral.morador.name}* (~${(quemMaisUsouVaral.totalRackMinutes / 60).toFixed(1)}h)`
        : `• Quem mais usou varal: Sem dados`,
      quemMenosUsouVaral
        ? `• Quem menos usou varal: *${quemMenosUsouVaral.morador.name}* (~${(quemMenosUsouVaral.totalRackMinutes / 60).toFixed(1)}h)`
        : `• Quem menos usou varal: Sem dados`,
      `\n✨ _Gestão inteligente de lavanderia no Apê 802_`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121316] text-[#1A1D20] dark:text-zinc-100 flex flex-col transition-colors pb-16">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 bg-[#1B2A4A] text-white border-b border-[#23355C] shadow-sm mobile-header-spacing transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToApp}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Voltar ao aplicativo público"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao App</span>
            </button>

            <div className="h-6 w-px bg-white/15 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FEF9C3] text-[#1B2A4A] flex items-center justify-center p-1 shrink-0 font-bold">
                <GaiolaLogo className="w-6 h-6" showChain={false} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight leading-none text-white">
                    Gaiola 802 · Admin
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-zinc-950 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                    <span>Restrito</span>
                  </span>
                </div>
                <p className="text-[10px] text-white/60 mt-0.5">
                  Painel de Métricas & Auditoria de Lavanderia
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode button */}
            <button
              onClick={onToggleDark}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Copy report button */}
            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl bg-[#FEF9C3] hover:bg-[#FDE68A] text-[#1B2A4A] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Copiar relatório formatado do mês"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-700" />
                  <span className="text-emerald-800 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">Copiar Relatório</span>
                  <span className="sm:hidden">Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 space-y-6 flex-1">
        {/* Month Selector Bar */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Período de Análise
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="w-5 h-5 text-[#1B2A4A] dark:text-amber-300" />
              <h2 className="text-lg font-bold capitalize text-zinc-900 dark:text-zinc-100">
                {monthLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentMonth}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Mês Atual
            </button>

            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Global Summary KPI Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Shirt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Total de Lavagens
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {totalMonthWashes} {totalMonthWashes === 1 ? 'ciclo' : 'ciclos'}
                </div>
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">no mês</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Máquina Ligada
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  ~{totalMachineHours}h
                </div>
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">tempo total</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Varais Ocupados
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  ~{totalRackHours}h
                </div>
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">secagem total</span>
          </div>

          {/* Card 4: Consumo Elétrico da Lavadora */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 fill-amber-500/20" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Consumo da Máquina
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-baseline gap-1.5">
                  <span>~{totalMonthKwh.toFixed(2)} kWh</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {totalMonthEnergyCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono text-right leading-tight">
              Brastemp BWK12<br />Light RJ
            </span>
          </div>
        </section>

        {/* 4 Destaques Principais: Quem mais/menos lavou e mais/menos usou varal */}
        <section aria-label="Destaques do mês" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Quem Lavou Mais */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Trophy className="w-16 h-16 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-4 h-4" />
              <span>Quem Lavou Mais</span>
            </div>

            {quemLavouMais && quemLavouMais.totalWashes > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                  style={{ backgroundColor: quemLavouMais.morador.color.hex }}
                >
                  {quemLavouMais.morador.avatarInitials}
                </div>
                <div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {quemLavouMais.morador.name}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">
                    {quemLavouMais.totalWashes} {quemLavouMais.totalWashes === 1 ? 'lavagem' : 'lavagens'} (
                    {totalMonthWashes > 0
                      ? `${Math.round((quemLavouMais.totalWashes / totalMonthWashes) * 100)}%`
                      : '0%'}
                    )
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-400">Nenhuma lavagem no mês</div>
            )}
          </div>

          {/* 2. Quem Lavou Menos */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <TrendingDown className="w-16 h-16 text-zinc-500" />
            </div>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <TrendingDown className="w-4 h-4" />
              <span>Quem Lavou Menos</span>
            </div>

            {quemLavouMenos ? (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                  style={{ backgroundColor: quemLavouMenos.morador.color.hex }}
                >
                  {quemLavouMenos.morador.avatarInitials}
                </div>
                <div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {quemLavouMenos.morador.name}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">
                    {quemLavouMenos.totalWashes} {quemLavouMenos.totalWashes === 1 ? 'lavagem' : 'lavagens'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-400">Sem dados</div>
            )}
          </div>

          {/* 3. Quem Usou Mais o Varal */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/60 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Wind className="w-16 h-16 text-amber-600" />
            </div>
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Wind className="w-4 h-4" />
              <span>Mais Usou o Varal</span>
            </div>

            {quemMaisUsouVaral && quemMaisUsouVaral.totalRackMinutes > 0 ? (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                  style={{ backgroundColor: quemMaisUsouVaral.morador.color.hex }}
                >
                  {quemMaisUsouVaral.morador.avatarInitials}
                </div>
                <div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {quemMaisUsouVaral.morador.name}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">
                    ~{(quemMaisUsouVaral.totalRackMinutes / 60).toFixed(1)}h ocupando varal
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-400">Nenhum uso de varal</div>
            )}
          </div>

          {/* 4. Quem Menos Usou o Varal */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Sparkles className="w-16 h-16 text-zinc-500" />
            </div>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Menos Usou o Varal</span>
            </div>

            {quemMenosUsouVaral ? (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-xs"
                  style={{ backgroundColor: quemMenosUsouVaral.morador.color.hex }}
                >
                  {quemMenosUsouVaral.morador.avatarInitials}
                </div>
                <div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {quemMenosUsouVaral.morador.name}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-0.5">
                    ~{(quemMenosUsouVaral.totalRackMinutes / 60).toFixed(1)}h ocupando varal
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-zinc-400">Sem dados</div>
            )}
          </div>
        </section>

        {/* Painel Dedicado: Consumo Elétrico & Rateio da Lavadora (Brastemp 12kg BWK12 · Light Copacabana) */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-5">
          {/* Header da Seção de Energia */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-5 h-5 fill-amber-500/20" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Consumo Elétrico & Rateio da Lavadora
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Brastemp 12kg BWK12 (110V)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    Light S.A. Copacabana
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Selo Procel A · Média INMETRO: 0,372 kWh/ciclo padrão · Cálculo de custos para divisão justa no Apê 802
                </p>
              </div>
            </div>

            {/* Controles de Tarifa & Bandeira */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl text-xs font-medium">
                {TARIFF_FLAGS.map((flag) => {
                  const isSelected = flag.id === selectedFlagId;
                  return (
                    <button
                      key={flag.id}
                      onClick={() => handleSelectFlag(flag.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                      title={`${flag.name}: ${flag.addition > 0 ? `+R$ ${flag.addition}/kWh` : 'Sem acréscimo'}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: flag.colorHex }}
                      />
                      <span>{flag.name.replace('Bandeira ', '').split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Botão de Ajustar Tarifa Base */}
              <button
                onClick={() => setIsEditingTariff(!isEditingTariff)}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-colors"
                title="Configurar valor base do kWh cobrado pela Light"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>R$ {effectiveTariffRate.toFixed(2)}/kWh</span>
              </button>
            </div>
          </div>

          {/* Editor rápido inline de Tarifa se aberto */}
          {isEditingTariff && (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>Tarifa Residencial B1 da Light (Copacabana, Rio de Janeiro)</span>
                </div>
                <div className="text-zinc-500 dark:text-zinc-400">
                  Tarifa base ANEEL: R$ 0,881/kWh. Com impostos (ICMS 18-20%, PIS/COFINS e CIP iluminação): ~R$ 0,98/kWh (Verde).
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-zinc-500 whitespace-nowrap">Tarifa Base (R$/kWh):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  max="5.00"
                  value={tempTariffInput}
                  onChange={(e) => setTempTariffInput(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-center"
                />
                <button
                  onClick={() => {
                    const parsed = parseFloat(tempTariffInput);
                    if (!isNaN(parsed) && parsed > 0) {
                      handleUpdateBaseTariff(parsed);
                    }
                    setIsEditingTariff(false);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#1B2A4A] text-white font-semibold hover:bg-[#23355C]"
                >
                  Salvar
                </button>
                <button
                  onClick={() => {
                    handleUpdateBaseTariff(DEFAULT_BASE_TARIFF_KWH);
                    setIsEditingTariff(false);
                  }}
                  className="px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-600 underline"
                  title="Restaurar padrão Light Copacabana"
                >
                  Padrão (0,98)
                </button>
              </div>
            </div>
          )}

          {/* Cards Rápidos de Balanço de Energia */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Consumo Total no Mês
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {totalMonthKwh.toFixed(2)} kWh
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Brastemp 12kg BWK12 ({totalMonthWashes} ciclos rodados)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Custo Total na Conta de Luz
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                R$ {totalMonthEnergyCost.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                Light Copacabana: R$ {effectiveTariffRate.toFixed(2)}/kWh
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Custo Médio por Lavagem
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                ~R$ {averageCostPerWash.toFixed(2)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                ~{(totalMonthWashes > 0 ? totalMonthKwh / totalMonthWashes : INMETRO_STANDARD_KWH).toFixed(3)} kWh por ciclo
              </div>
            </div>
          </div>

          {/* Cards de Rateio da Conta de Luz por Morador */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Rateio da Conta de Luz da Lavadora (Quem deve quanto):</span>
              <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Total Máquina: R$ {totalMonthEnergyCost.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {sortedByWashes.map((s) => {
                const percentOfEnergy =
                  totalMonthEnergyCost > 0
                    ? Math.round((s.totalCost / totalMonthEnergyCost) * 100)
                    : 0;

                return (
                  <div
                    key={s.morador.id}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: s.morador.color.hex }}
                        >
                          {s.morador.avatarInitials}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {s.morador.name}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {s.totalWashes} {s.totalWashes === 1 ? 'lavagem' : 'lavagens'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          R$ {s.totalCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          {s.totalKwh.toFixed(2)} kWh
                        </div>
                      </div>
                    </div>

                    {/* Barra de Proporção */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${percentOfEnergy}%`,
                            backgroundColor: s.morador.color.hex,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>{percentOfEnergy}% do consumo</span>
                        <span>Brastemp BWK12</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Quadro Comparativo Completo por Morador */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Auditoria e Estatísticas
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1B2A4A] dark:text-zinc-300" />
                <span>Ranking & Comparativo dos Moradores no Mês</span>
              </h3>
            </div>
            <span className="text-xs text-zinc-400">Ordenado por lavagens</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Morador</th>
                  <th className="py-2.5 px-3 text-center">Lavagens</th>
                  <th className="py-2.5 px-3 text-center">% do Total</th>
                  <th className="py-2.5 px-3 text-center">Consumo (kWh)</th>
                  <th className="py-2.5 px-3 text-center">Custo Máquina</th>
                  <th className="py-2.5 px-3 text-center">Tempo Máquina</th>
                  <th className="py-2.5 px-3 text-center">Tempo Varal</th>
                  <th className="py-2.5 px-3 text-center">Varal 1 (Janela)</th>
                  <th className="py-2.5 px-3 text-center">Varal 2 (Interno)</th>
                  <th className="py-2.5 px-3 text-center">Recolhimento Rápido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {sortedByWashes.map((s, idx) => {
                  const percentOfTotal =
                    totalMonthWashes > 0 ? Math.round((s.totalWashes / totalMonthWashes) * 100) : 0;

                  return (
                    <tr
                      key={s.morador.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-zinc-400">
                        {idx + 1}º
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: s.morador.color.hex }}
                          >
                            {s.morador.avatarInitials}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {s.morador.name}
                            </div>
                            <div className="text-[10px] text-zinc-400">{s.morador.room}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {s.totalWashes}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${percentOfTotal}%`,
                                backgroundColor: s.morador.color.hex,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
                            {percentOfTotal}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {s.totalKwh.toFixed(2)} kWh
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        R$ {s.totalCost.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        ~{(s.totalMachineMinutes / 60).toFixed(1)}h
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        ~{(s.totalRackMinutes / 60).toFixed(1)}h
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        ~{(s.rack1Minutes / 60).toFixed(1)}h
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        ~{(s.rack2Minutes / 60).toFixed(1)}h
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.earlyReleases > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            ✓ {s.earlyReleases}x recolheu cedo
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabela de Registro Completo de Lavagens do Mês */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Histórico Auditável
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1B2A4A] dark:text-zinc-300" />
                <span>Todas as Lavagens do Mês ({filteredList.length})</span>
              </h3>
            </div>

            {/* Filtro rápido por morador */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setFilterMorador('all')}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                  filterMorador === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200'
                }`}
              >
                Todos
              </button>
              {ROOMMATES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFilterMorador(m.id)}
                  className={`px-2 py-1 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                    filterMorador === m.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: m.color.hex }}
                  />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Nenhuma lavagem registrada para este filtro no mês de {monthLabel}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-2.5 px-3">Data & Hora</th>
                    <th className="py-2.5 px-3">Morador</th>
                    <th className="py-2.5 px-3">Ciclo</th>
                    <th className="py-2.5 px-3 text-center">Consumo BWK12</th>
                    <th className="py-2.5 px-3">Varais</th>
                    <th className="py-2.5 px-3 text-center">Máquina</th>
                    <th className="py-2.5 px-3 text-center">Liberação Varal</th>
                    <th className="py-2.5 px-3">Clima Copa</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {filteredList.map((res) => {
                    const morador = ROOMMATES.find((m) => m.id === res.moradorId) || ROOMMATES[0];
                    const load = LOAD_TYPES.find((t) => t.id === res.loadTypeId);
                    const start = new Date(res.startTime);
                    const machineEnd = new Date(res.machineEndTime);
                    const rackRelease = res.isCompletedEarly && res.earlyReleasedAt
                      ? new Date(res.earlyReleasedAt)
                      : new Date(res.rackReleaseTime);
                    const cycleKwh = getReservationKwh(res.loadTypeId);
                    const cycleCost = Number((cycleKwh * effectiveTariffRate).toFixed(2));

                    return (
                      <tr
                        key={res.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                          <div>
                            {start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[9px] text-white shrink-0"
                              style={{ backgroundColor: morador.color.hex }}
                            >
                              {morador.avatarInitials}
                            </div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {morador.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 font-medium">
                          {load?.name}
                        </td>

                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <div className="font-semibold text-amber-600 dark:text-amber-400 text-xs">
                            {cycleKwh.toFixed(3)} kWh
                          </div>
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                            R$ {cycleCost.toFixed(2)}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {res.assignedRacks.length === 0 ? (
                            <span className="text-[10px] text-zinc-400">Apenas máquina</span>
                          ) : res.assignedRacks.length === 2 ? (
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                              Varal 1 + 2
                            </span>
                          ) : res.assignedRacks[0] === 'rack_1' ? (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Varal 1 (Janela)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              Varal 2 (Interno)
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                          até {machineEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                          ~{rackRelease.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-zinc-500 truncate max-w-[140px]">
                          {res.weatherFactor.conditionText} ({res.weatherFactor.temperature}°C)
                        </td>

                        <td className="py-3 px-3 text-center">
                          {res.isCompletedEarly ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Recolhido Cedo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
