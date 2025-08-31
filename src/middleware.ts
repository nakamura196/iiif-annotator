import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  ...routing,
  localePrefix: 'as-needed' // Don't show prefix for default locale (ja)
});

export const config = {
  // Match all paths except static files and api routes
  matcher: [
    // Skip all internal paths (_next)
    // Skip all API routes
    // Skip all static files (images, fonts, etc.)
    '/((?!_next|api|favicon.ico|.*\\..*).*)'
  ]
};