import { WeatherData } from '../types';

/**
 * Open-Meteo URL configured specifically for Copacabana, Rio de Janeiro (-22.9698, -43.1868).
 * Requests 7 days of hourly forecasts with temperature, relative humidity, wind speed, wind gusts,
 * cloud cover, precipitation probability, and weather codes.
 */
const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-22.9698&longitude=-43.1868&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m&timezone=America%2FSao_Paulo&forecast_days=7';

const CACHE_KEY = 'gaiola802_weather_cache_v2';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// Robust fallback data for Copacabana if offline or network error
const FALLBACK_WEATHER: WeatherData = {
  current: {
    temperature: 26,
    relativeHumidity: 68,
    weatherCode: 1, // Mainly clear
    isDay: 1,
    windSpeed: 16,
    windGusts: 24,
    cloudCover: 30,
    precipitationProbability: 10,
    precipitation: 0,
  },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => {
      const d = new Date();
      d.setHours(i, 0, 0, 0);
      return d.toISOString();
    }),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 24 + Math.round(5 * Math.sin(i / 4))),
    relative_humidity_2m: Array.from({ length: 48 }, (_, i) => 65 + Math.round(15 * Math.cos(i / 4))),
    weathercode: Array(48).fill(1),
    wind_speed_10m: Array.from({ length: 48 }, () => 14),
    cloud_cover: Array.from({ length: 48 }, () => 35),
    precipitation_probability: Array(48).fill(10),
    precipitation: Array(48).fill(0),
  },
  dryingCondition: {
    level: 'optimal',
    title: 'Condições favoráveis para secagem',
    description: 'Brisa de Copacabana e calor auxiliando a secagem no varal.',
    multiplier: 0.90,
    windTip: 'Brisa litorânea ativa na janela (Varal 1 favorável)',
  },
  updatedAt: new Date().toISOString(),
};

/**
 * Maps WMO weather code to Portuguese condition label, icon, and rain status.
 */
export function interpretWeatherCode(code: number): {
  label: string;
  isRain: boolean;
  iconName: string;
} {
  // WMO Weather interpretation codes
  if (code === 0) return { label: 'Céu Limpo (Sol)', isRain: false, iconName: 'sun' };
  if (code === 1) return { label: 'Predomínio de Sol', isRain: false, iconName: 'sun-medium' };
  if (code === 2) return { label: 'Sol com Nuvens', isRain: false, iconName: 'cloud-sun' };
  if (code === 3) return { label: 'Nublado / Encoberto', isRain: false, iconName: 'cloud' };
  if (code >= 45 && code <= 48) return { label: 'Nevoeiro Litorâneo', isRain: false, iconName: 'cloud-fog' };
  if (code >= 51 && code <= 55) return { label: 'Garoa Leve', isRain: true, iconName: 'cloud-drizzle' };
  if (code >= 61 && code <= 65) return { label: 'Chuva', isRain: true, iconName: 'cloud-rain' };
  if (code >= 80 && code <= 82) return { label: 'Pancadas de Chuva', isRain: true, iconName: 'cloud-rain' };
  if (code >= 95) return { label: 'Trovoada', isRain: true, iconName: 'cloud-lightning' };
  return { label: 'Parcialmente Nublado', isRain: false, iconName: 'cloud-sun' };
}

export interface DryingCalculationParams {
  temperature: number; // °C
  humidity: number; // %
  weatherCode: number; // WMO code
  windSpeed: number; // km/h
  cloudCover?: number; // % (0-100)
  assignedRacks?: ('rack_1' | 'rack_2')[];
}

/**
 * Calculates physics-based drying multiplier using temperature, humidity, wind, and clouds in Copacabana.
 * Multiplier < 1.0 means clothes dry faster.
 * Multiplier > 1.0 means clothes take longer to dry.
 */
export function calculateDryingMultiplier({
  temperature,
  humidity,
  weatherCode,
  windSpeed,
  cloudCover = 40,
  assignedRacks = ['rack_1'],
}: DryingCalculationParams): {
  multiplier: number;
  conditionText: string;
  impactSummary: string;
  windSummary: string;
  humiditySummary: string;
  isRain: boolean;
} {
  const { isRain } = interpretWeatherCode(weatherCode);

  // 1. Temperature Impact (reference: 25°C)
  let tempFactor = 1.0;
  if (temperature >= 32) tempFactor = 0.82; // Calor intenso do Rio
  else if (temperature >= 28) tempFactor = 0.88; // Quente
  else if (temperature >= 25) tempFactor = 0.96; // Confortável
  else if (temperature >= 22) tempFactor = 1.06; // Ameno
  else if (temperature >= 18) tempFactor = 1.18; // Fresco
  else tempFactor = 1.30; // Frio

  // 2. Humidity Impact (reference: 65%)
  // High humidity (85%+) saturates air, severely slowing evaporation
  let humFactor = 1.0;
  let humiditySummary = 'Umidade normal';
  if (humidity <= 50) {
    humFactor = 0.85;
    humiditySummary = `Ar seco (${Math.round(humidity)}%), evaporação acelerada`;
  } else if (humidity <= 65) {
    humFactor = 0.96;
    humiditySummary = `Umidade favorável (${Math.round(humidity)}%)`;
  } else if (humidity <= 75) {
    humFactor = 1.08;
    humiditySummary = `Umidade moderada (${Math.round(humidity)}%)`;
  } else if (humidity <= 84) {
    humFactor = 1.25;
    humiditySummary = `Umidade elevada (${Math.round(humidity)}%), secagem mais lenta`;
  } else if (humidity <= 90) {
    humFactor = 1.40;
    humiditySummary = `Ar muito úmido de Copacabana (${Math.round(humidity)}%), evaporação retardada`;
  } else {
    humFactor = 1.55;
    humiditySummary = `Ar saturado (${Math.round(humidity)}%), secagem bastante demorada`;
  }

  // 3. Wind Impact (Copacabana sea breeze)
  // Strong coastal wind clears the humid boundary layer; low wind slows down drying
  let windFactor = 1.0;
  let windSummary = 'Vento normal';
  if (windSpeed >= 24) {
    windFactor = 0.82; // Vento forte do mar
    windSummary = `Vento intenso (${Math.round(windSpeed)} km/h), varrendo a umidade`;
  } else if (windSpeed >= 16) {
    windFactor = 0.90; // Boa brisa de Copacabana
    windSummary = `Brisa do litoral (${Math.round(windSpeed)} km/h) acelerando o varal`;
  } else if (windSpeed >= 10) {
    windFactor = 1.00; // Vento moderado
    windSummary = `Vento moderado (${Math.round(windSpeed)} km/h)`;
  } else if (windSpeed >= 6) {
    windFactor = 1.12; // Vento fraco
    windSummary = `Vento fraco (${Math.round(windSpeed)} km/h), menos ventilação`;
  } else {
    windFactor = 1.25; // Quase sem vento / ar parado
    windSummary = `Pouco vento (${Math.round(windSpeed)} km/h), ar quase parado na área`;
  }

  // 4. Cloud Cover / Solar Radiation Impact
  let cloudFactor = 1.0;
  if (cloudCover <= 20) {
    cloudFactor = 0.90; // Céu limpo, radiação solar ativa
  } else if (cloudCover <= 60) {
    cloudFactor = 1.00; // Sol com nuvens
  } else {
    cloudFactor = 1.15; // Nublado / sem sol
  }

  // 5. Varal Location Adjustment (Varal 1 na janela vs Varal 2 interno)
  let rackMultiplier = 1.0;
  if (assignedRacks.includes('rack_1') && !assignedRacks.includes('rack_2')) {
    // Varal 1 fica na janela: se tiver vento, seca ainda mais rápido
    if (windSpeed >= 14) {
      rackMultiplier = 0.93; // -7% tempo no varal da janela com vento
    }
  } else if (assignedRacks.includes('rack_2') && !assignedRacks.includes('rack_1')) {
    // Varal 2 interno: menos circulação de ar
    if (windSpeed < 10) {
      rackMultiplier = 1.05; // +5% tempo na área interna sem vento
    }
  }

  // 6. Rain Impact
  let rainFactor = 1.0;
  if (isRain) {
    rainFactor = 1.45; // Chuva
  }

  // Combined Multiplier clamped between 0.60 (ultra fast) and 1.85 (very slow)
  const rawMultiplier = tempFactor * humFactor * windFactor * cloudFactor * rackMultiplier * rainFactor;
  const multiplier = Math.min(1.85, Math.max(0.60, Number(rawMultiplier.toFixed(2))));

  // Condition Text & Impact Summary
  let conditionText = 'Tempo Padrão';
  let impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid · ${Math.round(windSpeed)} km/h • Secagem no tempo regular`;

  const diffPercent = Math.round(Math.abs(multiplier - 1.0) * 100);

  if (isRain) {
    conditionText = 'Chuva em Copacabana';
    impactSummary = `Chuva no período (+${diffPercent}% de tempo) • Mantenha roupas na área coberta`;
  } else if (multiplier <= 0.85) {
    conditionText = windSpeed >= 16 ? 'Calor & Brisa Forte' : 'Sol & Calor';
    impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid · ${Math.round(windSpeed)} km/h • Secagem ${diffPercent}% mais rápida`;
  } else if (multiplier >= 1.25) {
    if (humidity >= 80 && windSpeed < 10) {
      conditionText = 'Alta Umidade & Pouco Vento';
      impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid · ${Math.round(windSpeed)} km/h • Secagem ${diffPercent}% mais lenta`;
    } else if (humidity >= 80) {
      conditionText = 'Ar Úmido de Praia';
      impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid • Secagem ${diffPercent}% mais lenta`;
    } else if (cloudCover > 70) {
      conditionText = 'Tempo Nublado';
      impactSummary = `Nublado (${Math.round(temperature)}°C) • Secagem ${diffPercent}% mais lenta`;
    } else {
      conditionText = 'Secagem Lenta';
      impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid • Secagem ${diffPercent}% mais lenta`;
    }
  } else {
    conditionText = cloudCover > 60 ? 'Nublado Ameno' : 'Brisa Moderada';
    impactSummary = `${Math.round(temperature)}°C · ${Math.round(humidity)}% umid · ${Math.round(windSpeed)} km/h • Ritmo estável`;
  }

  return {
    multiplier,
    conditionText,
    impactSummary,
    windSummary,
    humiditySummary,
    isRain,
  };
}

/**
 * Fetches real-time Copacabana weather from Open-Meteo with caching.
 */
export async function fetchCopacabanaWeather(): Promise<WeatherData> {
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
    // Ignore cache parse error
  }

  try {
    const response = await fetch(OPEN_METEO_URL);
    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.statusText}`);
    }

    const data = await response.json();
    const cur = data.current || data.current_weather;

    const temp = Math.round(cur?.temperature_2m ?? cur?.temperature ?? 26);
    const humidity = Math.round(cur?.relative_humidity_2m ?? 65);
    const code = cur?.weather_code ?? cur?.weathercode ?? 1;
    const wind = Math.round(cur?.wind_speed_10m ?? cur?.windspeed ?? 15);
    const gusts = Math.round(cur?.wind_gusts_10m ?? wind * 1.4);
    const cloud = Math.round(cur?.cloud_cover ?? 35);
    const precipProb = Math.round(data.hourly?.precipitation_probability?.[0] ?? 0);
    const precip = Number(cur?.precipitation ?? 0);

    const calc = calculateDryingMultiplier({
      temperature: temp,
      humidity,
      weatherCode: code,
      windSpeed: wind,
      cloudCover: cloud,
    });

    let dryingLevel: 'optimal' | 'normal' | 'slow' | 'rain_risk' = 'normal';
    let dryingTitle = 'Condições normais para secagem';
    let dryingDesc = calc.impactSummary;
    let windTip = calc.windSummary;

    if (calc.isRain) {
      dryingLevel = 'rain_risk';
      dryingTitle = 'Possibilidade de chuva em Copacabana';
      dryingDesc = 'Chuva no litoral. Mantenha as janelas protegidas para não molhar as roupas.';
    } else if (calc.multiplier <= 0.85) {
      dryingLevel = 'optimal';
      dryingTitle = 'Condições ótimas para secagem rápida hoje';
      dryingDesc = `Calor (${temp}°C) e brisa do mar acelerando a liberação do varal em até ${Math.round((1 - calc.multiplier) * 100)}%!`;
    } else if (calc.multiplier >= 1.25) {
      dryingLevel = 'slow';
      dryingTitle = 'Secagem mais lenta no apê hoje';
      dryingDesc = `Umidade alta (${humidity}%) ou pouco vento em Copacabana. O varal levará mais tempo para secar.`;
    }

    const weatherPayload: WeatherData = {
      current: {
        temperature: temp,
        relativeHumidity: humidity,
        weatherCode: code,
        isDay: cur?.is_day ?? 1,
        windSpeed: wind,
        windGusts: gusts,
        cloudCover: cloud,
        precipitationProbability: precipProb,
        precipitation: precip,
      },
      hourly: {
        time: data.hourly?.time ?? FALLBACK_WEATHER.hourly.time,
        temperature_2m: data.hourly?.temperature_2m ?? FALLBACK_WEATHER.hourly.temperature_2m,
        relative_humidity_2m:
          data.hourly?.relative_humidity_2m ?? FALLBACK_WEATHER.hourly.relative_humidity_2m,
        weathercode: data.hourly?.weather_code ?? data.hourly?.weathercode ?? FALLBACK_WEATHER.hourly.weathercode,
        wind_speed_10m: data.hourly?.wind_speed_10m ?? FALLBACK_WEATHER.hourly.wind_speed_10m,
        cloud_cover: data.hourly?.cloud_cover ?? FALLBACK_WEATHER.hourly.cloud_cover,
        precipitation_probability:
          data.hourly?.precipitation_probability ?? FALLBACK_WEATHER.hourly.precipitation_probability,
        precipitation: data.hourly?.precipitation ?? FALLBACK_WEATHER.hourly.precipitation,
      },
      dryingCondition: {
        level: dryingLevel,
        title: dryingTitle,
        description: dryingDesc,
        multiplier: calc.multiplier,
        windTip,
      },
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(weatherPayload));
    return weatherPayload;
  } catch (err) {
    console.warn('[WeatherService] Using fallback Copacabana weather:', err);
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
 * Predicts climate factor for a specific target date and time from the hourly forecast.
 * Dynamically adjusts drying multiplier based on temperature, humidity, wind, and clouds for that specific hour!
 */
export function getForecastForTime(
  weather: WeatherData | null,
  targetDate: Date,
  assignedRacks?: ('rack_1' | 'rack_2')[]
): {
  temperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  cloudCover: number;
  multiplier: number;
  conditionText: string;
  impactSummary: string;
  windSummary: string;
  humiditySummary: string;
} {
  // If no weather available, return neutral reference values
  if (!weather || !weather.hourly?.time?.length) {
    return {
      temperature: 26,
      humidity: 65,
      weatherCode: 1,
      windSpeed: 15,
      cloudCover: 35,
      multiplier: 1.0,
      conditionText: 'Tempo Padrão',
      impactSummary: 'Previsão estável de Copacabana (ritmo regular)',
      windSummary: 'Brisa regular de 15 km/h',
      humiditySummary: 'Umidade normal de 65%',
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
  let wind = weather.current.windSpeed;
  let cloud = weather.current.cloudCover ?? 40;

  if (index !== -1) {
    temp = Math.round(weather.hourly.temperature_2m[index] ?? temp);
    humidity = Math.round(weather.hourly.relative_humidity_2m[index] ?? humidity);
    code = weather.hourly.weathercode[index] ?? code;
    wind = Math.round(weather.hourly.wind_speed_10m?.[index] ?? wind);
    cloud = Math.round(weather.hourly.cloud_cover?.[index] ?? cloud);
  }

  const calc = calculateDryingMultiplier({
    temperature: temp,
    humidity,
    weatherCode: code,
    windSpeed: wind,
    cloudCover: cloud,
    assignedRacks,
  });

  return {
    temperature: temp,
    humidity,
    weatherCode: code,
    windSpeed: wind,
    cloudCover: cloud,
    multiplier: calc.multiplier,
    conditionText: calc.conditionText,
    impactSummary: calc.impactSummary,
    windSummary: calc.windSummary,
    humiditySummary: calc.humiditySummary,
  };
}
