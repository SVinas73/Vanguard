import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Proteger todas las rutas EXCEPTO:
     * - /login, /register
     * - /api/auth/* (callbacks de NextAuth)
     * - /api/cron/* (Vercel Cron; se autentica con CRON_SECRET)
     * - /api/health (health check público)
     * - /_next/* (archivos estáticos)
     * - Archivos públicos (manifest, service worker, íconos, logo)
     */
    "/((?!login|register|api/auth|api/cron|api/health|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|icons/|vang.png|vanguard-logo.svg).*)",
  ],
};