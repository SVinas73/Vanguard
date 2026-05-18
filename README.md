# Vanguard — Sistema de Gestión Inteligente

ERP/WMS para PyMEs con IA omnisciente, multi-almacén, multi-idioma y API completa.

> Sistema pensado para reemplazar SAP B1 / Odoo / NetSuite con setup en minutos y precio accesible. Hecho para LATAM (CFE Uruguay, AFIP Argentina, SAT México).

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
#   database/migrations/001_*.sql ... 015_*.sql

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
| IA generativa | Google Gemini 2.0 Flash (multimodal) |
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
| `GOOGLE_AI_API_KEY` | Extracción de facturas con IA | https://aistudio.google.com/app/apikey |
| `AUDIT_HMAC_KEY` | Hash chain anti-tampering | `openssl rand -hex 32` |
| `PII_ENCRYPTION_KEY` | Encriptación de PII | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (opcional) | https://sentry.io |

---

## Módulos

### Operaciones
- **Stock** — catálogo con multi-almacén
- **Movimientos** — entradas, salidas, transferencias, ajustes
- **WMS Enterprise** — recepción, picking por olas, packing, dispatch
- **Comercial** — clientes 360°, cotizaciones, ventas, cobranzas
- **Compras** — proveedores, órdenes de compra
- **Facturación electrónica** — CFE Uruguay

### Post-venta
- **Taller** — órdenes de trabajo + mantenimiento
- **Garantías** — entitlements con vencimiento + reclamos
- **Tickets** — soporte al cliente con SLA
- **RMA** — devoluciones y reembolsos

### Producción
- **BOM** — listas de materiales
- **Ensamblajes** — órdenes de producción
- **QMS** — control de calidad

### Análisis
- **Analytics IA** — predicciones, anomalías, asociaciones
- **Demand Planning** — forecast + reorden
- **Reportes** — 30+ reportes con export Excel/PDF/CSV
- **Costos** — valuación FIFO, márgenes

### Control
- **Aprobaciones** — workflows con bloqueo
- **Seriales** — trazabilidad por número
- **Trazabilidad** — historial completo
- **Auditoría** — log inmutable con hash chain
- **RRHH** — empleados, asistencia, vacaciones

---

## Diferenciadores únicos

1. **IA omnisciente** — el asistente consulta toda la base en lenguaje natural
2. **Extracción de facturas con IA** — foto/PDF → líneas estructuradas (Gemini multimodal)
3. **Anti-estrés inteligente** — detecta sobrecarga y sugiere Focus Mode
4. **Hash chain anti-tampering** — auditoría inmutable
5. **API-First** — REST documentada con OpenAPI 3.1 + webhooks con reintentos exponenciales
6. **Multi-idioma** — ES/EN/PT cambiando en runtime
7. **Multi-almacén nativo** — desglose por almacén en todas las pantallas

---

## Desarrollo

```bash
npm test              # Vitest (163 unit tests)
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
- `/api/v1/openapi.json` — spec OpenAPI 3.1 de la API pública

---

## Deploy

### Vercel (recomendado)

1. Importar el repo en Vercel
2. Cargar las variables de entorno del `.env.example`
3. Deploy automático en push a `main`

### Supabase

- Correr migrations en orden desde `database/migrations/`
- RLS viene activado en todas las tablas (migrations 008 y 011)

### Backend de IA (opcional)

El backend Python `Vanguard-IA` (FastAPI) sirve predicciones avanzadas. Sin él, los paneles Analytics IA quedan vacíos pero el resto funciona normal.

---

## Arquitectura

```
app/
├── api/                    Endpoints REST (App Router)
│   ├── v1/                 API pública con OpenAPI + scopes
│   ├── asistente/chat/     Chat con IA omnisciente
│   ├── ai/                 Extracción multimodal
│   ├── auth/               NextAuth
│   ├── gdpr/               Export/delete (compliance)
│   └── health/             Health check
├── login/                  Auth
├── landing/                Landing comercial
└── page.tsx                Dashboard principal

components/
├── dashboard/              KPIs, value, charts, insights
├── stock/ wms/ comercial/  Módulos de operaciones
├── taller/ garantias/ tickets/ rma/    Post-venta
├── facturacion/ rrhh/ reports/ analytics/    Etc.
├── ui/                     Design system + charts BI
└── providers/              Theme, i18n, session

lib/
├── inventory-valuation.ts  FIFO unificado
├── api-gateway/            Auth + rate limit
├── security/               Permisos, rate limit, zod
├── audit.ts                Hash chain
├── error-tracking.ts       Sentry-compatible minimal
└── rrhh.ts garantias.ts ...

database/migrations/         15 migrations SQL idempotentes
```

---

## Licencia

Privado. Todos los derechos reservados.
