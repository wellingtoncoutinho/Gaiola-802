import { WeatherData } from '../types';

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-22.9698&longitude=-43.1868&hourly=temperature_2m,relative_humidity_2m,weathercode&current_weather=true&timezone=America%2FSao_Paulo';

const CACHE_KEY = 'gaiola802_weather_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Fallback data if offline or network error
const FALLBACK_WEATHER: WeatherData = {
  current: {
    temperature: 27,
    relativeHumidity: 68,
    weatherCode: 1, // Mainly clear
    isDay: 1,
    windSpeed: 14,
  },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => {
      const d = new Date();
      d.setHours(i, 0, 0, 0);
      return d.toISOString();
    }),
    temperature_2m: [
      23, 23, 22, 22, 23, 24, 25, 27, 29, 30, 31, 31, 30, 29, 28, 27, 26, 25, 25, 24, 24, 24, 23, 23,
    ],
    relative_humidity_2m: [
      82, 83, 85, 85, 80, 75, 68, 62, 58, 55, 54, 56, 60, 64, 68, 72, 75, 78, 80, 81, 82, 82, 83, 83,
    ],
    weathercode: Array(24).fill(1),
  },
  dryingCondition: {
    level: 'optimal',
    title: 'Condições ótimas para secagem',
    description: 'Brisa de Copacabana e calor favorável para varal rápido.',
    multiplier: 0.85,
  },
  updatedAt: new Date().toISOString(),
};

export function interpretWeatherCode(code: number): {
  label: string;
  isRain: boolean;
  iconName: string;
} {
  // WMO Weather interpretation codes
  if (code === 0) return { label: 'Céu Limpo', isRain: false, iconName: 'sun' };
  if (code === 1 || code === 2) return { label: 'Sol com Nuvens', isRain: false, iconName: 'sun-medium' };
  if (code === 3) return { label: 'Ensolarado c/ Nuvens', isRain: false, iconName: 'cloud' };
  if (code >= 45 && code <= 48) return { label: 'Nevoeiro Litorâneo', isRain: false, iconName: 'cloud-fog' };
  if (code >= 51 && code <= 55) return { label: 'Garoa Leve', isRain: true, iconName: 'cloud-drizzle' };
  if (code >= 61 && code <= 65) return { label: 'Chuva', isRain: true, iconName: 'cloud-rain' };
  if (code >= 80 && code <= 82) return { label: 'Pancadas de Chuva', isRain: true, iconName: 'cloud-rain' };
  if (code >= 95) return { label: 'Trovoada', isRain: true, iconName: 'cloud-lightning' };
  return { label: 'Parcialmente Nublado', isRain: false, iconName: 'cloud-sun' };
}

export function calculateDryingMultiplier(
  temperature: number,
  humidity: number,
  weatherCode: number
): {
  multiplier: number;
  conditionText: string;
  impactSummary: string;
  isRain: boolean;
} {
  const { isRain } = interpretWeatherCode(weatherCode);

  let multiplier = 1.0;
  let conditionText = 'Condições normais (1.0x)';
  let impactSummary = 'Ritmo padrão de secagem';

  if (isRain) {
    multiplier = 1.45;
    conditionText = 'Chuva prevista no período';
    impactSummary = 'Chuva em Copacabana (+45% de tempo no varal)';
  } else if (temperature > 28 && humidity < 65) {
    multiplier = 0.75;
    conditionText = 'Sol & Baixa Umidade';
    impactSummary = `${Math.round(temperature)}°C com ${Math.round(humidity)}% umidade • Secagem 25% mais rápida`;
  } else if (temperature < 22 || humidity > 80) {
    multiplier = 1.35;
    conditionText = 'Alta Umidade ou Fresco';
    impactSummary = `${Math.round(temperature)}°C com ${Math.round(humidity)}% umidade • Secagem 35% mais lenta`;
  } else {
    multiplier = 1.0;
    conditionText = 'Tempo Padrão';
    impactSummary = `${Math.round(temperature)}°C agradável • Secagem no tempo de referência`;
  }

  return {
    multiplier,
    conditionText,
    impactSummary,
    isRain,
  };
}

export async function fetchCopacabanaWeather(): Promise<WeatherData> {
  // Check cached data
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: WeatherData = JSON.parse(cached);
      const age = Date.now() - new Date(parsed.updatedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  try {
    const response = await fetch(OPEN_METEO_URL);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`);
    }

    const data = await response.json();
    const temp = Math.round(data.current_weather?.temperature ?? 26);
    const code = data.current_weather?.weathercode ?? 1;
    const wind = Math.round(data.current_weather?.windspeed ?? 12);

    // Get current hour humidity from hourly array
    const nowIso = new Date().toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
    const hourlyTimes: string[] = data.hourly?.time ?? [];
    let currentHumidity = 65;
    const hourIdx = hourlyTimes.findIndex((t: string) => t.startsWith(nowIso));
    if (hourIdx !== -1 && data.hourly?.relative_humidity_2m?.[hourIdx] !== undefined) {
      currentHumidity = Math.round(data.hourly.relative_humidity_2m[hourIdx]);
    }

    const { multiplier, impactSummary, isRain } = calculateDryingMultiplier(temp, currentHumidity, code);

    let dryingLevel: 'optimal' | 'normal' | 'slow' | 'rain_risk' = 'normal';
    let dryingTitle = 'Condições normais para secagem';
    let dryingDesc = impactSummary;

    if (isRain) {
      dryingLevel = 'rain_risk';
      dryingTitle = 'Possibilidade de chuva hoje';
      dryingDesc = 'Secagem mais lenta. Recomendado estender em área coberta.';
    } else if (multiplier <= 0.8) {
      dryingLevel = 'optimal';
      dryingTitle = 'Condições ideais para secagem rápida hoje';
      dryingDesc = `Calor de Copacabana (${temp}°C) acelerando a liberação do varal em até 25%!`;
    } else if (multiplier >= 1.3) {
      dryingLevel = 'slow';
      dryingTitle = 'Alta umidade: secagem mais lenta';
      dryingDesc = `Umidade elevada (${currentHumidity}%) em Copacabana; roupas levarão mais tempo para secar.`;
    }

    const weatherPayload: WeatherData = {
      current: {
        temperature: temp,
        relativeHumidity: currentHumidity,
        weatherCode: code,
        isDay: data.current_weather?.is_day ?? 1,
        windSpeed: wind,
      },
      hourly: {
        time: data.hourly?.time ?? FALLBACK_WEATHER.hourly.time,
        temperature_2m: data.hourly?.temperature_2m ?? FALLBACK_WEATHER.hourly.temperature_2m,
        relative_humidity_2m:
          data.hourly?.relative_humidity_2m ?? FALLBACK_WEATHER.hourly.relative_humidity_2m,
        weathercode: data.hourly?.weathercode ?? FALLBACK_WEATHER.hourly.weathercode,
      },
      dryingCondition: {
        level: dryingLevel,
        title: dryingTitle,
        description: dryingDesc,
        multiplier,
      },
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(weatherPayload));
    return weatherPayload;
  } catch {
    // Return cached or fallback
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return FALLBACK_WEATHER;
  }
}

/**
 * Predicts climate factor for a specific target date and time from the hourly forecast
 */
export function getForecastForTime(
  weather: WeatherData | null,
  targetDate: Date
): {
  temperature: number;
  humidity: number;
  weatherCode: number;
  multiplier: number;
  conditionText: string;
  impactSummary: string;
} {
  if (!weather || !weather.hourly?.time?.length) {
    return {
      temperature: 26,
      humidity: 68,
      weatherCode: 1,
      multiplier: 1.0,
      conditionText: 'Tempo Padrão',
      impactSummary: 'Previsão estável de Copacabana (ritmo regular)',
    };
  }

  // Format target date as "YYYY-MM-DDTHH"
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const h = String(targetDate.getHours()).padStart(2, '0');
  const targetPrefix = `${y}-${m}-${d}T${h}`;

  const index = weather.hourly.time.findIndex((t) => t.startsWith(targetPrefix));

  let temp = weather.current.temperature;
  let humidity = weather.current.relativeHumidity;
  let code = weather.current.weatherCode;

  if (index !== -1) {
    temp = weather.hourly.temperature_2m[index] ?? temp;
    humidity = weather.hourly.relative_humidity_2m[index] ?? humidity;
    code = weather.hourly.weathercode[index] ?? code;
  }

  const { multiplier, conditionText, impactSummary } = calculateDryingMultiplier(temp, humidity, code);

  return {
    temperature: temp,
    humidity,
    weatherCode: code,
    multiplier,
    conditionText,
    impactSummary,
  };
}
