'use client';

import { useState, useEffect, useRef } from 'react';
import { getWeatherIcon, getWeatherCondition } from '@/lib/weather-icons';

interface WeatherData {
  temperature: number;
  condition: string;
  iconPath: string;
  isDay: boolean;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchWeather(lat?: number, lon?: number) {
      try {
        const params = lat && lon ? `?lat=${lat}&lon=${lon}` : '';
        const res = await fetch(`/api/weather${params}`);
        if (!res.ok) throw new Error('Weather fetch failed');

        const data = await res.json();
        setWeather({
          temperature: data.temperature,
          condition: getWeatherCondition(data.conditionCode),
          iconPath: getWeatherIcon(data.conditionCode, data.isDay),
          isDay: data.isDay,
        });
      } catch {
        // Weather is non-critical — fail silently
      } finally {
        setIsLoading(false);
      }
    }

    // Try browser geolocation, fall back to server default
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(), // Denied or blocked — use server default
        { timeout: 3000 }
      );
    } else {
      fetchWeather();
    }
  }, []);

  return { weather, isLoading };
}
