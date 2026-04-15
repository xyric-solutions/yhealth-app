/**
 * Visitor Controller
 * Records visits (public) and serves admin analytics (unique visitors per day, by country)
 */

import { Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { recordVisit, getVisitorAnalytics } from '../services/visitor.service.js';

const VISITOR_COOKIE_NAME = 'vid';
const VISITOR_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/** Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1) to 127.0.0.1 for localhost check */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return '';
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);
  return trimmed;
}

function isLocalhost(ip: string): boolean {
  const n = normalizeIp(ip);
  return n === '127.0.0.1' || n === '::1' || n === '';
}

/** Get client IP: respect X-Forwarded-For when behind a proxy (first entry is client). */
function getClientIp(req: AuthenticatedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = req.ip || (req.socket?.remoteAddress as string) || '';
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return raw;
}

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  PK: 'Pakistan',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  IN: 'India',
  BD: 'Bangladesh',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  // Add more as needed
};

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

// Lazy-load geoip-lite (optional dependency, sync lookup)
function getCountryFromIp(ip: string): { countryCode: string | null; countryName: string | null } {
  // Default to Pakistan if country cannot be determined
  const DEFAULT_COUNTRY_CODE = 'PK';
  const DEFAULT_COUNTRY_NAME = 'Pakistan';
  
  // Localhost never resolves to a country — in production you'll see real IPs from X-Forwarded-For
  if (isLocalhost(ip)) {
    const devCode = process.env['VISITOR_DEV_COUNTRY_CODE'];
    const devName = process.env['VISITOR_DEV_COUNTRY_NAME'];
    if (devCode) {
      return {
        countryCode: devCode.slice(0, 2).toUpperCase(),
        countryName: (devName || getCountryName(devCode.slice(0, 2).toUpperCase())).slice(0, 100) || DEFAULT_COUNTRY_NAME,
      };
    }
    // Default to Pakistan for localhost
    return { countryCode: DEFAULT_COUNTRY_CODE, countryName: DEFAULT_COUNTRY_NAME };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require('geoip-lite') as { lookup: (ip: string) => { country?: string } | null };
    const lookup = geoip.lookup(ip);
    if (!lookup || !lookup.country) {
      // Default to Pakistan if lookup fails
      return { countryCode: DEFAULT_COUNTRY_CODE, countryName: DEFAULT_COUNTRY_NAME };
    }
    const countryCode = lookup.country.toUpperCase();
    return {
      countryCode,
      countryName: getCountryName(countryCode),
    };
  } catch {
    // Default to Pakistan on error
    return { countryCode: DEFAULT_COUNTRY_CODE, countryName: DEFAULT_COUNTRY_NAME };
  }
}

/**
 * Record a visit (public). Sets vid cookie if missing; resolves country from IP.
 * POST /api/visitors
 */
export const recordVisitHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const ip = getClientIp(req);
    let visitorKey = req.cookies?.[VISITOR_COOKIE_NAME] as string | undefined;
    if (!visitorKey || visitorKey.length > 64) {
      visitorKey = crypto.randomUUID();
      const isProduction = process.env['NODE_ENV'] === 'production';
      res.cookie(VISITOR_COOKIE_NAME, visitorKey, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: VISITOR_COOKIE_MAX_AGE_MS,
        secure: isProduction,
        path: '/',
      });
    }

    const { countryCode, countryName } = getCountryFromIp(ip);
    // Ensure we always have a country (default to Pakistan)
    const finalCountryCode = countryCode || 'PK';
    const finalCountryName = countryName || 'Pakistan';
    
    await recordVisit({
      visitorKey,
      countryCode: finalCountryCode,
      countryName: finalCountryName,
      userId: req.user?.userId ?? null,
    });
    res.status(204).end();
  }
);

/**
 * Get visitor analytics (admin only). Time series and by-country breakdown.
 * GET /api/admin/analytics/visitors?startDate=&endDate=
 */
export const getVisitorAnalyticsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const startParam = (req.query.startDate as string) || '';
    const endParam = (req.query.endDate as string) || '';
    const endDate = endParam ? new Date(endParam) : new Date();
    let startDate = startParam ? new Date(startParam) : new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    if (Number.isNaN(startDate.getTime())) {
      throw ApiError.badRequest('Invalid startDate');
    }
    if (Number.isNaN(endDate.getTime())) {
      throw ApiError.badRequest('Invalid endDate');
    }
    if (startDate > endDate) {
      throw ApiError.badRequest('startDate must be before endDate');
    }

    const result = await getVisitorAnalytics({ startDate, endDate, groupBy: 'day' });
    ApiResponse.success(res, result);
  }
);
