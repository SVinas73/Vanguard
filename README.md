# Vanguard — Sistema de Gestión Inteligente

Sistema de gestión para PyMEs con IA, multi-almacén y multi-idioma.

---

## Quick start

```bash
# 1. Clonar
git clone https://github.com/SVinas73/Vanguard.git
cd Vanguard

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env.local
# Editá .env.local con tus credenciales (Supabase, Google AI, etc.)

# 4. Aplicar migraciones SQL
# En Supabase SQL Editor, correr en orden los archivos de:
#   database/migrations/

# 5. Levantar dev server
npm run dev

# Abrir http://localhost:3000
```

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript 5 (strict) |
| Estilos | Tailwind CSS + Public Sans |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Auth | NextAuth |
| IA generativa | Google Gemini 2.0 Flash (asistente) |
| Predicción/Anomalías | Backend Python (FastAPI) — `Vanguard-IA` |
| Charts | Recharts |
| State | Zustand |
| Testing | Vitest + jsdom |
| Traducciones | react-i18next |

---

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa. Las principales:

| Variable | Para qué | Cómo obtener |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Conexión Supabase | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente público | Mismo lugar |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (bypass RLS) | Mismo lugar — **NUNCA exponer al cliente** |
| `NEXTAUTH_SECRET` | Firma de sesiones | `openssl rand -base64 32` |
| `GOOGLE_AI_API_KEY` | Asistente IA | https://aistudio.google.com/app/apikey |
| `AUDIT_HMAC_KEY` | Hash chain anti-tampering | `openssl rand -hex 32` |
| `PII_ENCRYPTION_KEY` | Encriptación de PII | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (opcional) | https://sentry.io |

---

## Módulos

### Comercial
- **Solicitudes de insumos** — solicitud, orden interna, pendientes de aprobación y análisis de insumos

### Logística
- **Transacciones entre almacenes** — transferencias entre almacenes
- **Stock** — catálogo con multi-almacén
- **Reabastecimiento IA** — EOQ + punto de reorden

### Post-venta
- **Taller** — órdenes de trabajo + mantenimiento
- **Garantías** — entitlements con vencimiento + reclamos
- **Tickets** — soporte al cliente con SLA
- **RMA** — devoluciones y reembolsos

### Control & Seguimiento
- **Trazabilidad** — historial completo de lotes y seriales
- **Auditoría** — log inmutable con hash chain

### Configuración
- **Mis empresas** — organizaciones del usuario

---

## Diferenciadores únicos

1. **IA omnisciente** — el asistente consulta la base en lenguaje natural
2. **Anti-estrés inteligente** — detecta sobrecarga y sugiere Focus Mode
3. **Hash chain anti-tampering** — auditoría inmutable
4. **Multi-idioma** — ES/EN/PT cambiando en runtime
5. **Multi-almacén nativo** — desglose por almacén en todas las pantallas

---

## Desarrollo

```bash
npm test              # Vitest (unit tests)
npm run test:watch    # Modo watch
npx tsc --noEmit      # Type check
npm run build         # Build producción
npm start             # Levantar build
```

---

## Endpoints útiles

- `/login` — autenticación
- `/landing` — landing page comercial
- `/api/health` — health check (200 / 503)

---

## Deploy

### Vercel (recomendado)

1. Importar el repo en Vercel
2. Cargar las variables de entorno del `.env.example`
3. Deploy automático en push a `main`

### Supabase

- Correr migrations en orden desde `database/migrations/`
- RLS viene activado en las tablas de seguridad (migration 011)

### Backend de IA (opcional)

El backend Python `Vanguard-IA` (FastAPI) sirve predicciones avanzadas. Sin él, los paneles de IA usan el cálculo local y el resto funciona normal.

---

## Arquitectura

```
app/
├── api/                    Endpoints REST (App Router)
│   ├── asistente/chat/     Chat con IA omnisciente
│   ├── insumos/            Solicitudes de insumos
│   ├── cron/               Vencimientos de solicitudes de insumos
│   ├── auth/               NextAuth
│   ├── gdpr/               Export/delete (compliance)
│   └── health/             Health check
├── login/                  Auth
├── landing/                Landing comercial
└── page.tsx                Shell principal (sidebar + módulos)

components/
├── comercial/ insumos/     Solicitudes de insumos
├── stock/ movimientos/ replenishment/    Logística
├── taller/ garantias/ tickets/ rma/    Post-venta
├── traceability/ audit/    Control & Seguimiento
├── organization/           Mis empresas
├── ui/                     Design system + charts BI
└── providers/              Theme, i18n, session

lib/
├── inventory-valuation.ts  FIFO unificado
├── insumos/                Reglas de solicitudes de insumos
├── security/               Permisos, rate limit, zod
├── audit.ts                Hash chain
├── error-tracking.ts       Sentry-compatible minimal
└── garantias.ts tickets.ts ...

database/migrations/         Migrations SQL idempotentes
```

---

## Licencia

Privado. Todos los derechos reservados.
