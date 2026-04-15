import { NextRequest, NextResponse } from 'next/server';

/**
 * Spotify OAuth callback handler.
 * Spotify redirects here with ?code=...&state=... after user authorization.
 * We forward the code/state to the Express server and redirect to settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Use NEXT_PUBLIC_SITE_URL for redirects — request.nextUrl.origin resolves to
  // the internal Docker host (0.0.0.0:8080) in production, not the public domain
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const settingsUrl = new URL('/settings', baseUrl);

  if (error) {
    settingsUrl.searchParams.set('spotify', 'error');
    settingsUrl.searchParams.set('error', error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set('spotify', 'error');
    settingsUrl.searchParams.set('error', 'missing_params');
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Extract auth token from cookie and forward to Express server
    const token = request.cookies.get('balencia_access_token')?.value;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/spotify/auth/callback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, state }),
    });

    if (response.ok) {
      settingsUrl.searchParams.set('spotify', 'connected');
      return NextResponse.redirect(settingsUrl);
    }

    const data = await response.json().catch(() => null);
    settingsUrl.searchParams.set('spotify', 'error');
    settingsUrl.searchParams.set('error', data?.message || 'callback_failed');
    return NextResponse.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set('spotify', 'error');
    settingsUrl.searchParams.set('error', 'server_unreachable');
    return NextResponse.redirect(settingsUrl);
  }
}
