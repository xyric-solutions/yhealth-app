import { NextRequest, NextResponse } from 'next/server';

// In-memory cache: key = "lat,lon" → { data, timestamp }
const cache = new Map<string, { data: WeatherResponse; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface WeatherResponse {
  temperature: number;
  unit: string;
  conditionCode: number;
  condition: string;
  isDay: boolean;
  location?: string;
}

/**
 * Get user location from IP using free ipapi.co service.
 * Falls back to Lahore, PK if the lookup fails.
 */
async function getLocationFromIP(request: NextRequest): Promise<{ lat: number; lon: number; city: string }> {
  try {
    // Get client IP from headers (works behind proxies/CDNs)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

    // For localhost/private IPs, use ipapi without IP param (auto-detects server IP)
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.');
    const url = isLocal
      ? 'https://ipapi.co/json/'
      : `https://ipapi.co/${ip}/json/`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lon: data.longitude,
          city: data.city || 'Unknown',
        };
      }
    }
  } catch {
    // IP geolocation failed — use fallback
  }

  // Default fallback: Lahore, Pakistan
  return { lat: 31.55, lon: 74.35, city: 'Lahore' };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');

    let lat: number;
    let lon: number;
    let city: string | undefined;

    if (latParam && lonParam) {
      // Client provided coordinates (from browser geolocation)
      lat = parseFloat(latParam);
      lon = parseFloat(lonParam);
    } else {
      // Auto-detect from IP
      const loc = await getLocationFromIP(request);
      lat = loc.lat;
      lon = loc.lon;
      city = loc.city;
    }

    // Round to 1 decimal for cache key
    const cacheKey = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Open-Meteo API — free, no key required
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'Weather API unavailable' }, { status: 502 });
    }

    const raw = await res.json();
    const current = raw.current;

    const data: WeatherResponse = {
      temperature: Math.round(current.temperature_2m),
      unit: '°C',
      conditionCode: current.weather_code,
      condition: getConditionText(current.weather_code),
      isDay: current.is_day === 1,
      location: city,
    };

    cache.set(cacheKey, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}

function getConditionText(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 57) return 'Freezing Drizzle';
  if (code <= 63) return 'Rain';
  if (code <= 65) return 'Heavy Rain';
  if (code <= 67) return 'Freezing Rain';
  if (code <= 75) return 'Snow';
  if (code === 77) return 'Snow Grains';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code === 95) return 'Thunderstorm';
  if (code <= 99) return 'Hail Storm';
  return 'Unknown';
}
