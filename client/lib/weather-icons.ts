/**
 * Maps WMO weather codes to local SVG icon paths in /Weather/
 */

const BASE = '/Weather';

export function getWeatherIcon(code: number, isDay: boolean = true): string {
  // Clear sky
  if (code === 0) return isDay ? `${BASE}/Group 1-1.svg` : `${BASE}/Group 8.svg`;
  // Partly cloudy
  if (code <= 2) return `${BASE}/Group 1.svg`;
  // Overcast
  if (code === 3) return `${BASE}/Group 2.svg`;
  // Fog
  if (code >= 45 && code <= 48) return `${BASE}/Group 2.svg`;
  // Drizzle
  if (code >= 51 && code <= 55) return `${BASE}/Group 7.svg`;
  // Freezing drizzle
  if (code >= 56 && code <= 57) return `${BASE}/Group 6.svg`;
  // Rain
  if (code >= 61 && code <= 63) return `${BASE}/Group 12.svg`;
  // Heavy rain
  if (code >= 65 && code <= 67) return `${BASE}/Group 13.svg`;
  // Snow
  if (code >= 71 && code <= 77) return `${BASE}/Group 6.svg`;
  // Rain showers
  if (code >= 80 && code <= 82) return `${BASE}/Group 7.svg`;
  // Snow showers
  if (code >= 85 && code <= 86) return `${BASE}/Group 6.svg`;
  // Thunderstorm
  if (code === 95) return `${BASE}/Group 14.svg`;
  // Thunderstorm with hail
  if (code >= 96 && code <= 99) return `${BASE}/Group 15.svg`;
  // Windy / default
  return `${BASE}/Group 11.svg`;
}

export function getWeatherCondition(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 56 && code <= 57) return 'Freezing Drizzle';
  if (code >= 61 && code <= 63) return 'Rain';
  if (code >= 65 && code <= 67) return 'Heavy Rain';
  if (code >= 71 && code <= 75) return 'Snow';
  if (code === 77) return 'Snow Grains';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code === 95) return 'Thunderstorm';
  if (code >= 96) return 'Hail Storm';
  return 'Unknown';
}
