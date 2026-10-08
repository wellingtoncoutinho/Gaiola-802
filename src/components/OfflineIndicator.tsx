import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 flex items-center gap-2 rounded-xl bg-amber-900/90 text-amber-100 backdrop-blur-md px-3.5 py-2 text-xs font-medium shadow-md border border-amber-700/50">
      <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-300" />
      <span>Modo offline ativo. Os agendamentos locais continuam funcionando normalmente.</span>
    </div>
  );
};
