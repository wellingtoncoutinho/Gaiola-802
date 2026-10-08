import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { GaiolaLogo } from './GaiolaLogo';

export const PWAInstallButton: React.FC = () => {
  return null;
};

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B2A4A] bg-[#FEF9C3] hover:bg-[#FDE68A] transition-colors rounded-xl shadow-xs"
        title="Instalar Gaiola 802 no seu celular"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B2A4A] bg-[#FEF9C3] hover:bg-[#FDE68A] transition-colors rounded-xl shadow-xs"
          title="Instalar no iPhone"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#1B2A4A] text-[#FEF9C3] flex items-center justify-center p-1.5 shrink-0 shadow-xs">
                  <GaiolaLogo className="w-full h-full" showChain={false} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Instalar Gaiola 802 no iPhone
                  </h3>
                  <p className="text-xs text-zinc-500">Acesse direto da tela de início</p>
                </div>
              </div>

              <div className="space-y-3 my-4 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    1
                  </span>
                  <span>
                    No Safari, toque no ícone de <strong className="text-zinc-800 dark:text-zinc-200">Compartilhar</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5 text-blue-500" />) na barra inferior.
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    2
                  </span>
                  <span>
                    Role a lista para baixo e toque em <strong className="text-zinc-800 dark:text-zinc-200">Adicionar à Tela de Início</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />).
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    3
                  </span>
                  <span>
                    Toque em <strong className="text-zinc-800 dark:text-zinc-200">Adicionar</strong> no canto superior direito. Pronto!
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-2 w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 py-2.5 text-xs font-semibold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
