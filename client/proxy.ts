/**
 * Server-side route protection proxy (Next.js 16+).
 * Redirects unauthenticated users to /auth/signin for protected routes.
 * This runs BEFORE any page rendering, preventing flash of protected content.
 * See: https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Public routes that don't require authentication
  const publicPrefixes = [
    '/auth',           // /auth/signin, /auth/signup, /auth/forgot-password, etc.
    '/blogs',
    '/help',
    '/webinars',
    '/community',
    '/press',
    '/pricing',
    '/privacy',
    '/terms',
    '/contact',
    '/about',
    '/api',
    '/_next',
    '/images',
    '/overview',
    '/Onboardingicons',
  ];

  const publicExact = [
    '/',
    '/robots.txt',
    '/sitemap.xml',
  ];

  // Allow exact public paths
  if (publicExact.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes
  if (publicPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files (anything with a file extension)
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to signin
  if (!isLoggedIn) {
    const signinUrl = new URL('/auth/signin', req.nextUrl.origin);
    signinUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Exclude /api/auth so NextAuth OAuth callbacks (Google PKCE, etc.) are not
  // intercepted by the auth wrapper above, which would consume the PKCE
  // verifier cookie and break the callback with "unexpected iss" / "InvalidCheck".
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
