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
     * - /_next/* (archivos estáticos)
     * - Archivos públicos
     */
    "/((?!login|register|api/auth|_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};