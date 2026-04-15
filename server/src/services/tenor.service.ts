/**
 * @file Tenor GIF Search Service
 * @description Searches Tenor API for GIFs. Used by AI coach to send contextual GIFs.
 */

import { logger } from './logger.service.js';

const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2/search';

interface TenorMediaFormat {
  url: string;
  dims: number[];
  duration: number;
  size: number;
}

interface TenorResult {
  id: string;
  title: string;
  media_formats: {
    gif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
  };
  url: string;
}

interface TenorSearchResponse {
  results: TenorResult[];
  next: string;
}

class TenorService {
  /**
   * Search for a GIF on Tenor and return the URL of the first result.
   * Returns null if no API key, no results, or API error.
   */
  async searchGif(query: string): Promise<string | null> {
    if (!TENOR_API_KEY) {
      logger.debug('[Tenor] No API key configured, skipping GIF search');
      return null;
    }

    try {
      const params = new URLSearchParams({
        q: query,
        key: TENOR_API_KEY,
        limit: '8',
        media_filter: 'gif,mediumgif,tinygif',
        contentfilter: 'medium',
      });

      const response = await fetch(`${TENOR_API_URL}?${params.toString()}`);

      if (!response.ok) {
        logger.warn('[Tenor] API returned non-OK status', {
          status: response.status,
          query,
        });
        return null;
      }

      const data = (await response.json()) as TenorSearchResponse;

      if (!data.results || data.results.length === 0) {
        return null;
      }

      // Pick a random result from first 8 for variety
      const randomIndex = Math.floor(Math.random() * data.results.length);
      const result = data.results[randomIndex];

      // Prefer mediumgif (smaller file size) > gif > tinygif
      const gifUrl =
        result.media_formats.mediumgif?.url ||
        result.media_formats.gif?.url ||
        result.media_formats.tinygif?.url ||
        null;

      return gifUrl;
    } catch (error) {
      logger.error('[Tenor] GIF search failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}

export const tenorService = new TenorService();
