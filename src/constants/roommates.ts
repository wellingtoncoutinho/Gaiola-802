import { Morador, LoadTypeConfig } from '../types';

export const ROOMMATES: Morador[] = [
  {
    id: 'thaciane',
    name: 'Thaciane',
    avatarInitials: 'TH',
    room: 'Quarto 1',
    color: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-800 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800/60',
      badgeBg: 'bg-indigo-100/70 dark:bg-indigo-900/50',
      badgeText: 'text-indigo-900 dark:text-indigo-200',
      hex: '#6366F1',
    },
  },
  {
    id: 'pedro',
    name: 'Pedro',
    avatarInitials: 'PE',
    room: 'Quarto 2',
    color: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      badgeBg: 'bg-emerald-100/70 dark:bg-emerald-900/50',
      badgeText: 'text-emerald-900 dark:text-emerald-200',
      hex: '#10B981',
    },
  },
  {
    id: 'yan',
    name: 'Yan',
    avatarInitials: 'YA',
    room: 'Quarto 3',
    color: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-800 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-800/60',
      badgeBg: 'bg-orange-100/70 dark:bg-orange-900/50',
      badgeText: 'text-orange-900 dark:text-orange-200',
      hex: '#F97316',
    },
  },
  {
    id: 'wellington',
    name: 'Wellington',
    avatarInitials: 'WE',
    room: 'Quarto 4',
    color: {
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800/60',
      badgeBg: 'bg-sky-100/70 dark:bg-sky-900/50',
      badgeText: 'text-sky-900 dark:text-sky-200',
      hex: '#0284C7',
    },
  },
  {
    id: 'fabio',
    name: 'Fabio',
    avatarInitials: 'FA',
    room: 'Suíte 5',
    color: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/60',
      badgeBg: 'bg-amber-100/70 dark:bg-amber-900/50',
      badgeText: 'text-amber-900 dark:text-amber-200',
      hex: '#F59E0B',
    },
  },
];

export const LOAD_TYPES: LoadTypeConfig[] = [
  {
    id: 'leve',
    name: 'Leve / Academia / Sintéticos',
    category: 'Roupas Leves',
    description: 'Dry-fit, roupas de praia, ginástica e tecidos finos',
    cycleMinutes: 45, // 45 min
    baseDryingHours: 4, // 4 h
    racksNeeded: 1,
    iconName: 'zap',
  },
  {
    id: 'dia_a_dia',
    name: 'Dia a dia / Camisetas / Algodão',
    category: 'Cotidiano',
    description: 'Camisas, bermudas leves, roupas casuais de algodão',
    cycleMinutes: 75, // 1h15 min
    baseDryingHours: 7, // 7 h
    racksNeeded: 1,
    iconName: 'shirt',
  },
  {
    id: 'pesada',
    name: 'Pesada / Toalhas / Jeans',
    category: 'Carga Pesada',
    description: 'Toalhas de banho felpudas, calças jeans e sarja',
    cycleMinutes: 105, // 1h45 min
    baseDryingHours: 12, // 12 h
    racksNeeded: 1,
    iconName: 'feather',
  },
  {
    id: 'cama_edredom',
    name: 'Cama / Edredom / Cobertor',
    category: 'Roupa de Cama Grande',
    description: 'Lençóis, mantas e edredons — escolha usar 1 ou os 2 varais',
    cycleMinutes: 130, // 2h10 min
    baseDryingHours: 18, // 18 h
    racksNeeded: 2,
    iconName: 'bed',
  },
  // Opções discretas / de manutenção
  {
    id: 'pano_chao',
    name: 'Limpeza de Pano de Chão',
    category: 'Limpeza & Faxina',
    description: 'Ciclo rápido dedicado para panos de chão e limpeza pesada',
    cycleMinutes: 30, // 30 min
    baseDryingHours: 3, // 3 h
    racksNeeded: 1,
    iconName: 'sparkles',
    isMaintenance: true,
  },
  {
    id: 'limpeza_maquina',
    name: 'Limpeza da Máquina',
    category: 'Manutenção da Máquina',
    description: 'Auto-higienização interna da lavadora (1h sem ocupar varais)',
    cycleMinutes: 60, // 1h
    baseDryingHours: 0, // 0 h - não usa varal
    racksNeeded: 0,
    iconName: 'wrench',
    isMaintenance: true,
  },
];

export const BUFFER_HANG_MINUTES = 30; // +30 min to hang clothes after machine finishes
export const BUFFER_COLLECT_MINUTES = 60; // +60 min to collect clothes after dry
