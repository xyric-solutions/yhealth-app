'use client';

import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Records a visit once per client load. Server sets `vid` cookie and resolves country from IP.
 * Runs silently; no UI. Uses credentials so cookie is sent/received (same-origin or CORS with credentials).
 */
export function VisitorTracker() {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;

    fetch(`${API_URL}/visitors`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Ignore errors (offline, rate limit, etc.)
    });
  }, []);

  return null;
}
