import React, { useState } from 'react';
import { Sun, Cloud, CloudRain, Droplets, Wind, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { WeatherData } from '../types';
import { interpretWeatherCode } from '../services/weatherService';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  weather,
  isLoading,
  onRefresh,
}) => {
  const [showHourly, setShowHourly] = useState(false);

  if (!weather) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between text-xs text-zinc-500 animate-pulse">
        <span>Carregando clima de Copacabana...</span>
      </div>
    );
  }

  const { current, dryingCondition } = weather;
  const condition = interpretWeatherCode(current.weatherCode);

  const getDryingBadgeStyle = () => {
    switch (dryingCondition.level) {
      case 'optimal':
        return 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE68A]';
      case 'slow':
        return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
      case 'rain_risk':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 transition-all shadow-xs">
      {/* Top row: Copacabana weather snapshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-[#1B2A4A] dark:text-zinc-200">
            {condition.isRain ? (
              <CloudRain className="w-5 h-5 text-blue-500" />
            ) : current.weatherCode === 0 ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Cloud className="w-5 h-5 text-zinc-500" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
                {current.temperature}°C
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {condition.label} · Copacabana
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <Droplets className="w-3 h-3 text-sky-500" />
                <span className="tabular-nums">{current.relativeHumidity}%</span> umidade
              </span>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <Wind className="w-3 h-3 text-teal-500" />
                <span className="tabular-nums">{current.windSpeed} km/h</span> brisa do mar
              </span>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1">
                <Cloud className="w-3 h-3 text-zinc-400" />
                <span className="tabular-nums">{current.cloudCover ?? 30}%</span> nuvens
              </span>
            </div>
          </div>
        </div>

        {/* Action and status tag */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${getDryingBadgeStyle()}`}
          >
            {dryingCondition.title}
          </div>

          <button
            onClick={() => setShowHourly(!showHourly)}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={showHourly ? 'Ocultar previsão por hora' : 'Ver previsão por hora'}
            aria-label="Alternar previsão por hora"
          >
            {showHourly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Atualizar clima"
            aria-label="Atualizar clima"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Description text & Coastal wind tip */}
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
        <p>{dryingCondition.description}</p>
        {dryingCondition.windTip && (
          <p className="text-[11px] text-teal-700 dark:text-teal-300 font-medium flex items-center gap-1">
            <Wind className="w-3 h-3 shrink-0" />
            <span>{dryingCondition.windTip}</span>
          </p>
        )}
      </div>

      {/* Hourly drawer */}
      {showHourly && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Próximas horas em Copacabana (Temperatura · Umidade · Vento)
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 text-center scrollbar-none">
            {weather.hourly.time.slice(0, 14).map((timeStr, idx) => {
              const time = new Date(timeStr);
              const temp = Math.round(weather.hourly.temperature_2m[idx]);
              const hum = Math.round(weather.hourly.relative_humidity_2m[idx]);
              const wind = Math.round(weather.hourly.wind_speed_10m?.[idx] ?? 14);
              const code = weather.hourly.weathercode[idx];
              const isRainHour = code >= 51;

              return (
                <div
                  key={timeStr}
                  className="flex-shrink-0 min-w-[68px] p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs space-y-0.5"
                >
                  <div className="text-[11px] font-medium text-zinc-400 tabular-nums">
                    {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="my-1 flex justify-center">
                    {isRainHour ? (
                      <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    ) : temp > 27 ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Cloud className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {temp}°C
                  </div>
                  <div className="text-[10px] text-sky-600 dark:text-sky-400 tabular-nums font-medium">
                    {hum}% umid
                  </div>
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 tabular-nums font-medium">
                    {wind} km/h
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
