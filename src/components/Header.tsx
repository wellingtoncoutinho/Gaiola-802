import React, { useState } from 'react';
import { User, ChevronDown, Check, Plus, Moon, Sun, Trash2, Sparkles, Shirt, Phone, Settings } from 'lucide-react';
import { ROOMMATES } from '../constants/roommates';
import { MoradorId } from '../types';
import { GaiolaLogo } from './GaiolaLogo';

interface HeaderProps {
  activeMoradorId: MoradorId;
  onSelectMorador: (id: MoradorId) => void;
  onOpenNewBooking: () => void;
  activeMainTab: 'laundry' | 'trash' | 'cleaning';
  onChangeMainTab: (tab: 'laundry' | 'trash' | 'cleaning') => void;
  activeTab: 'daily' | 'weekly' | 'agenda';
  onChangeTab: (tab: 'daily' | 'weekly' | 'agenda') => void;
  isDark: boolean;
  onToggleDark: () => void;
  onOpenPhonesModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMoradorId,
  onSelectMorador,
  onOpenNewBooking,
  activeMainTab,
  onChangeMainTab,
  activeTab,
  onChangeTab,
  isDark,
  onToggleDark,
  onOpenPhonesModal,
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

        {/* Zone 2: Main Navigation Tabs (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-white/10 rounded-xl border border-white/10 text-xs font-medium">
          <button
            onClick={() => onChangeMainTab('laundry')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMainTab === 'laundry'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>Lavanderia</span>
          </button>
          <button
            onClick={() => onChangeMainTab('trash')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMainTab === 'trash'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Escala do Lixo</span>
          </button>
          <button
            onClick={() => onChangeMainTab('cleaning')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMainTab === 'cleaning'
                ? 'bg-white text-[#1B2A4A] shadow-xs font-bold'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Limpeza da Casa</span>
          </button>
        </nav>

        {/* Zone 3: Actions + User Selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-2 text-zinc-900 dark:text-zinc-100 animate-in fade-in duration-150">
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
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
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

                  {/* Gerenciar Telefones e API WhatsApp */}
                  <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenPhonesModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#1B2A4A] dark:text-[#FEF9C3] hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Telefones & API Meta</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Primary Action: Nova Reserva */}
          <button
            onClick={onOpenNewBooking}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#1B2A4A] bg-[#FEF9C3] hover:bg-[#FDE68A] transition-transform active:scale-95 rounded-xl shadow-xs cursor-pointer"
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
