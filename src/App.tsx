/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Calendar,
  Layers,
  ListFilter,
  Sparkles,
  Droplets,
  CheckCircle2,
  Clock,
  Shirt,
  Wind,
} from 'lucide-react';
import { Header } from './components/Header';
import { WeatherWidget } from './components/WeatherWidget';
import { DailyTimeline } from './components/DailyTimeline';
import { WeeklyView } from './components/WeeklyView';
import { ReservationList } from './components/ReservationList';
import { NewReservationModal } from './components/NewReservationModal';
import { ReservationDetailModal } from './components/ReservationDetailModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ROOMMATES } from './constants/roommates';
import { MoradorId, Reservation, WeatherData } from './types';
import { fetchCopacabanaWeather } from './services/weatherService';
import {
  getActiveMoradorId,
  setActiveMoradorId,
  loadReservations,
  addReservation,
  deleteReservation,
  releaseReservationEarly,
} from './services/storageService';
import { getReservationStatus } from './utils/statusHelper';

export default function App() {
  // 1. Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gaiola802_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gaiola802_dark_mode', String(isDark));
  }, [isDark]);

  const toggleDark = () => setIsDark((prev) => !prev);

  // 2. Active Morador State
  const [activeMoradorId, setMoradorIdState] = useState<MoradorId>(getActiveMoradorId);

  const handleSelectMorador = (id: MoradorId) => {
    setMoradorIdState(id);
    setActiveMoradorId(id);
  };

  // 3. Navigation View Tab
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'agenda'>('daily');

  // 4. Date States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7; // Monday
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // 5. Reservations State
  const [reservations, setReservations] = useState<Reservation[]>(loadReservations);

  // 6. Weather State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const loadWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const data = await fetchCopacabanaWeather();
      setWeather(data);
    } catch {
      // handled inside service
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather();
    // Auto-refresh weather every 20 minutes
    const interval = setInterval(loadWeather, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadWeather]);

  // 7. Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Handlers
  const handleCreateReservation = (newRes: Reservation) => {
    const updated = addReservation(newRes);
    setReservations(updated);
  };

  const handleReleaseEarly = (id: string) => {
    const updated = releaseReservationEarly(id);
    setReservations(updated);
  };

  const handleDelete = (id: string) => {
    const updated = deleteReservation(id);
    setReservations(updated);
  };

  // Compute Current Instant Resource Status (Machine, Rack 1, Rack 2)
  const currentStatus = useMemo(() => {
    const now = new Date();
    const active = reservations.filter((r) => !r.isCompletedEarly);

    // 1. Machine
    let machineOccupant: { name: string; endFmt: string; initials: string; hex: string } | null = null;
    for (const r of active) {
      const start = new Date(r.startTime);
      const end = new Date(r.machineEndTime);
      if (now >= start && now < end) {
        const m = ROOMMATES.find((item) => item.id === r.moradorId) || ROOMMATES[0];
        machineOccupant = {
          name: m.name,
          endFmt: end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          initials: m.avatarInitials,
          hex: m.color.hex,
        };
        break;
      }
    }

    // 2. Rack 1
    let rack1Occupant: { name: string; endFmt: string; status: string; hex: string } | null = null;
    for (const r of active) {
      if (r.assignedRacks.includes('rack_1')) {
        const start = new Date(r.machineEndTime);
        const end = new Date(r.rackReleaseTime);
        if (now >= start && now < end) {
          const m = ROOMMATES.find((item) => item.id === r.moradorId) || ROOMMATES[0];
          const st = getReservationStatus(r, now);
          rack1Occupant = {
            name: m.name,
            endFmt: end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: st.shortLabel,
            hex: m.color.hex,
          };
          break;
        }
      }
    }

    // 3. Rack 2
    let rack2Occupant: { name: string; endFmt: string; status: string; hex: string } | null = null;
    for (const r of active) {
      if (r.assignedRacks.includes('rack_2')) {
        const start = new Date(r.machineEndTime);
        const end = new Date(r.rackReleaseTime);
        if (now >= start && now < end) {
          const m = ROOMMATES.find((item) => item.id === r.moradorId) || ROOMMATES[0];
          const st = getReservationStatus(r, now);
          rack2Occupant = {
            name: m.name,
            endFmt: end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: st.shortLabel,
            hex: m.color.hex,
          };
          break;
        }
      }
    }

    return {
      machine: machineOccupant,
      rack1: rack1Occupant,
      rack2: rack2Occupant,
    };
  }, [reservations]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121316] text-[#1A1D20] dark:text-zinc-100 flex flex-col transition-colors pb-24 md:pb-12">
      {/* 1. Header (Brand, Navigation & Roommate Selector) */}
      <Header
        activeMoradorId={activeMoradorId}
        onSelectMorador={handleSelectMorador}
        onOpenNewBooking={() => setIsNewModalOpen(true)}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isDark={isDark}
        onToggleDark={toggleDark}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Weather Banner Widget */}
        <WeatherWidget
          weather={weather}
          isLoading={weatherLoading}
          onRefresh={loadWeather}
        />

        {/* Live Status Cards (Live Overview) */}
        <section aria-label="Status atual dos recursos" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card: Máquina */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  currentStatus.machine
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                <Shirt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Máquina de Lavar
                </div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {currentStatus.machine ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: currentStatus.machine.hex }}
                      />
                      <span>{currentStatus.machine.name} batendo</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Livre agora</span>
                  )}
                </div>
              </div>
            </div>

            {currentStatus.machine && (
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                até {currentStatus.machine.endFmt}
              </span>
            )}
          </div>

          {/* Card: Varal 1 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  currentStatus.rack1
                    ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Varal 1 (Janela)
                </div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {currentStatus.rack1 ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: currentStatus.rack1.hex }}
                      />
                      <span>{currentStatus.rack1.name} ({currentStatus.rack1.status})</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Varal livre</span>
                  )}
                </div>
              </div>
            </div>

            {currentStatus.rack1 && (
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                libera ~{currentStatus.rack1.endFmt}
              </span>
            )}
          </div>

          {/* Card: Varal 2 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  currentStatus.rack2
                    ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Varal 2 (Interno)
                </div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {currentStatus.rack2 ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: currentStatus.rack2.hex }}
                      />
                      <span>{currentStatus.rack2.name} ({currentStatus.rack2.status})</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Varal livre</span>
                  )}
                </div>
              </div>
            </div>

            {currentStatus.rack2 && (
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                libera ~{currentStatus.rack2.endFmt}
              </span>
            )}
          </div>
        </section>

        {/* View Switch Content */}
        {activeTab === 'daily' && (
          <DailyTimeline
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            reservations={reservations}
            onSelectReservation={(res) => setSelectedReservation(res)}
          />
        )}

        {activeTab === 'weekly' && (
          <WeeklyView
            currentWeekStart={currentWeekStart}
            onChangeWeek={setCurrentWeekStart}
            reservations={reservations}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setActiveTab('daily');
            }}
            onSelectReservation={(res) => setSelectedReservation(res)}
          />
        )}

        {activeTab === 'agenda' && (
          <ReservationList
            reservations={reservations}
            onSelectReservation={(res) => setSelectedReservation(res)}
            onReleaseEarly={handleReleaseEarly}
            onDeleteReservation={handleDelete}
            activeMoradorId={activeMoradorId}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Natural Thumb Zone) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-safe">
        <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto px-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              activeTab === 'daily'
                ? 'text-[#1B2A4A] dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] mt-1">Diária</span>
          </button>

          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              activeTab === 'weekly'
                ? 'text-[#1B2A4A] dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1">Semanal</span>
          </button>

          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              activeTab === 'agenda'
                ? 'text-[#1B2A4A] dark:text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
          >
            <ListFilter className="w-5 h-5" />
            <span className="text-[10px] mt-1">Agenda</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 text-[#1B2A4A] dark:text-[#FEF9C3] font-bold min-h-[44px]"
          >
            <div className="w-8 h-8 rounded-full bg-[#FEF9C3] text-[#1B2A4A] flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[10px] mt-0.5 font-bold">Reservar</span>
          </button>
        </div>
      </div>

      {/* Offline Toast */}
      <OfflineIndicator />

      {/* New Reservation Modal */}
      <NewReservationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleCreateReservation}
        activeMoradorId={activeMoradorId}
        existingReservations={reservations}
        weather={weather}
        initialDate={selectedDate}
      />

      {/* Detail & WhatsApp Modal */}
      <ReservationDetailModal
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onReleaseEarly={handleReleaseEarly}
        onDeleteReservation={handleDelete}
      />
    </div>
  );
}
