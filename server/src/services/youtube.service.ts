import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

// In-memory cache with 24h TTL
const cache = new Map<string, { data: YouTubeVideo[]; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 500;

function getCacheKey(query: string): string {
  return query.toLowerCase().trim();
}

export async function searchYouTubeVideos(query: string, maxResults = 3): Promise<YouTubeVideo[]> {
  const apiKey = env.google?.apiKey;
  if (!apiKey) {
    logger.warn('[YouTube] No GOOGLE_API_KEY configured');
    return [];
  }

  const cacheKey = getCacheKey(query);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    logger.debug('[YouTube] Cache hit', { query });
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '26', // Howto & Style (fitness)
      maxResults: String(maxResults),
      key: apiKey,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[YouTube] API request failed', { status: response.status, error: errorText });
      return cached?.data || []; // Return stale cache on API error
    }

    const data = await response.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
          channelTitle: string;
        };
      }>;
    };

    const videos: YouTubeVideo[] = (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      channelTitle: item.snippet.channelTitle,
    }));

    // Evict oldest entries if cache is full
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    cache.set(cacheKey, { data: videos, expires: Date.now() + CACHE_TTL });
    logger.info('[YouTube] Fetched videos', { query, count: videos.length });
    return videos;
  } catch (error) {
    logger.error('[YouTube] Search failed', { query, error: error instanceof Error ? error.message : String(error) });
    return cached?.data || [];
  }
}
