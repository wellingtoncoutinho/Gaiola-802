import React, { useState } from 'react';
import { User, ChevronDown, Check, Plus, Moon, Sun } from 'lucide-react';
import { ROOMMATES } from '../constants/roommates';
import { MoradorId } from '../types';
import { GaiolaLogo } from './GaiolaLogo';

interface HeaderProps {
  activeMoradorId: MoradorId;
  onSelectMorador: (id: MoradorId) => void;
  onOpenNewBooking: () => void;
  activeTab: 'daily' | 'weekly' | 'agenda';
  onChangeTab: (tab: 'daily' | 'weekly' | 'agenda') => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMoradorId,
  onSelectMorador,
  onOpenNewBooking,
  activeTab,
  onChangeTab,
  isDark,
  onToggleDark,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const activeMorador = ROOMMATES.find((m) => m.id === activeMoradorId) || ROOMMATES[0];

  return (
    <header className="sticky top-0 z-40 bg-[#1B2A4A] text-white shadow-xs border-b border-[#23355C] mobile-header-spacing transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Wordmark & Brand mark com Logo da Gaiola */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center p-1 text-[#FEF9C3] hover:text-white transition-colors shrink-0 shadow-xs">
              <GaiolaLogo className="w-7 h-7" showChain={false} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white select-none leading-none">
                Gaiola 802
              </span>
              <span className="text-[10px] text-white/50 tracking-wider font-medium mt-0.5">
                Copacabana · RJ
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Tabs (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/10 text-xs font-medium">
          <button
            onClick={() => onChangeTab('daily')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'daily'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-semibold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            Visão Diária
          </button>
          <button
            onClick={() => onChangeTab('weekly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'weekly'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-semibold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => onChangeTab('agenda')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'agenda'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-semibold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            Todas as Reservas
          </button>
        </nav>

        {/* Zone 3: Actions + User Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Active Morador Selector ("Quem está usando?") */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition-all cursor-pointer"
              title="Alternar quem está usando agora"
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px]"
                style={{ backgroundColor: activeMorador.color.hex, color: '#FFFFFF' }}
              >
                {activeMorador.avatarInitials}
              </div>
              <span className="hidden sm:inline font-medium">{activeMorador.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/60" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-2 text-zinc-900 dark:text-zinc-100 animate-in fade-in duration-150">
                  <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    Quem está usando?
                  </div>
                  <div className="space-y-1">
                    {ROOMMATES.map((m) => {
                      const isSelected = m.id === activeMoradorId;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectMorador(m.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: m.color.hex }}
                            >
                              {m.avatarInitials}
                            </div>
                            <span>{m.name}</span>
                            <span className="text-[10px] text-zinc-400">({m.room})</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Primary Action: Nova Reserva */}
          <button
            onClick={onOpenNewBooking}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#1B2A4A] bg-[#FEF9C3] hover:bg-[#FDE68A] transition-transform active:scale-95 rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Nova Reserva</span>
            <span className="sm:hidden">Reservar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
