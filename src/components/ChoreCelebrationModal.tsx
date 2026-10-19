import React from 'react';
import { CheckCircle2, Sparkles, X, Trash2, Heart } from 'lucide-react';

interface ChoreCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'lixo' | 'limpeza';
  moradorName?: string;
  roomName?: string;
}

export const ChoreCelebrationModal: React.FC<ChoreCelebrationModalProps> = ({
  isOpen,
  onClose,
  type,
  moradorName,
  roomName,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 touch-none modal-backdrop-lock"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {type === 'lixo' ? '🗑️ Escala do Lixo Cumprida!' : '🧹 Limpeza Confirmada!'}
          </span>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            Muito obrigado{moradorName ? `, ${moradorName}` : ''}!
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            {type === 'lixo'
              ? 'A retirada do lixo de hoje foi registrada no sistema. Toda a Gaiola 802 agradece pelo cuidado com o apê!'
              : 'A manutenção da limpeza da casa desta semana foi registrada no sistema com sucesso!'}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Show, ver o aplicativo!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
