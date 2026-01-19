export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Proteger todas las rutas EXCEPTO:
     * - Archivos estáticos (_next)
     * - Archivos públicos (manifest, favicon, imágenes)
     * - Rutas de autenticación (login, register, api/auth)
     */
    '/((?!_next|favicon.ico|manifest.json|.*\\..+|login|register|api/auth).*)',
  ],
};