// =====================================================
// Contenido del centro de ayuda de Vanguard
// =====================================================
// Los docs viven inline en TS porque:
//   1. Cero config de webpack (no necesita raw-loader)
//   2. TypeScript valida que cada slug exista
//   3. Más rápido el bundle (no extra fetches)
// =====================================================

export interface DocSection {
  slug: string;
  titulo: string;
  categoria: 'inicio' | 'core' | 'operaciones' | 'analisis' | 'postventa' | 'sistema';
  resumen: string;
  contenido: string;
}

export const docs: DocSection[] = [
  {
    slug: 'getting-started',
    titulo: 'Primeros pasos',
    categoria: 'inicio',
    resumen: 'Bienvenida y orientación inicial del sistema',
    contenido: `# Bienvenido a Vanguard

Vanguard es un ERP/WMS pensado para PyMEs de LATAM. Te permite manejar **ventas, compras, stock, finanzas, depósito, taller y mucho más** desde un solo lugar — con módulos de IA que te ayudan a tomar mejores decisiones.

## ¿Por dónde empezar?

1. **Configurá tu organización**: andá al selector arriba del sidebar y creá tu empresa si todavía no la tenés.
2. **Cargá productos**: en *Stock → Productos* podés crear el catálogo. Si tenés un Excel, hay un importador.
3. **Cargá clientes y proveedores**: en *Comercial* y *Compras* respectivamente.
4. **Hacé tu primera venta**: *Comercial → Nueva orden de venta*. El sistema te avisa si no hay stock o si necesita aprobación.

## Conceptos clave

- **Multi-tenant**: una sola instancia puede servir a varias empresas. Cambiás entre ellas con el selector arriba.
- **Aprobaciones**: ciertas operaciones (descuentos altos, compras grandes) requieren autorización de un superior.
- **Auditoría**: todo lo que pasa queda registrado en un log inmutable. No se puede borrar ni alterar.
- **IA Omnisciente**: hay un asistente que entiende lenguaje natural y puede consultar/modificar datos del sistema por vos.

## Atajos útiles

| Acción | Atajo |
|---|---|
| Abrir asistente IA | Botón flotante abajo a la derecha |
| Buscar producto rápido | Click en la lupa del header |
| Cambiar idioma | Header → bandera |
| Cerrar sesión | Header → tu nombre → Salir |

## ¿Necesitás ayuda?

Cada módulo tiene su propia guía en este centro de ayuda. Buscá en la lista de la izquierda o usá el buscador.
`,
  },
  {
    slug: 'dashboard',
    titulo: 'Dashboard',
    categoria: 'core',
    resumen: 'Vista general del estado del negocio',
    contenido: `# Dashboard

El **Dashboard** es la primera pantalla que ves al entrar. Te muestra el estado general del negocio en tiempo real.

## ¿Qué mide?

- **Ventas del período**: facturación acumulada (mes/trimestre)
- **Stock crítico**: cuántos productos están por debajo del mínimo
- **Pedidos pendientes**: órdenes que esperan picking, despacho o facturación
- **Cuentas por cobrar**: cuánto te deben los clientes
- **Alertas**: aprobaciones pendientes, vencimientos, etc.

## Tip

Si querés métricas más financieras (margen, DSO, EBITDA), andá al módulo **Vista Ejecutiva** que está pensado para gerencia.
`,
  },
  {
    slug: 'executive',
    titulo: 'Vista Ejecutiva (C-Level)',
    categoria: 'core',
    resumen: 'KPIs financieros para gerencia y dueños',
    contenido: `# Vista Ejecutiva

Diseñada para **CEO, CFO y socios**. Muestra los indicadores que importan para tomar decisiones estratégicas.

## KPIs principales

- **Ingresos**: facturación del período comparada con el anterior
- **Margen bruto**: cuánto ganás después del costo de productos
- **DSO (Days Sales Outstanding)**: cuántos días en promedio tardás en cobrar
- **Cuentas por cobrar**: total adeudado por clientes
- **Aprobaciones pendientes**: cosas esperando tu firma

## Selector de período

Arriba a la derecha podés cambiar entre:
- **MTD** (mes corriente)
- **QTD** (trimestre corriente)
- **YTD** (año corriente)
- **12M** (últimos 12 meses)

## Gráficos

- **Tendencia de ingresos**: barras con margen superpuesto
- **Top productos por margen**: tabla con los productos que más rentan
- **Alertas críticas**: lista priorizada de cosas que requieren tu atención

## Tip

Mirá la **tendencia del margen %**. Si baja consistentemente, algo está pasando: o subieron costos, o estás dando muchos descuentos, o cambió el mix de productos.
`,
  },
  {
    slug: 'ventas',
    titulo: 'Ventas y Comercial',
    categoria: 'core',
    resumen: 'Cotizaciones, órdenes de venta, clientes',
    contenido: `# Ventas (Comercial)

El módulo **Comercial** maneja todo el ciclo comercial desde la cotización hasta la facturación.

## Flujo típico

1. **Cliente pide cotización** → Vendedor crea una cotización
2. **Cliente acepta** → La cotización se convierte en orden de venta
3. **Bodeguero prepara** → Se hace picking + packing en WMS
4. **Despacho** → Se entrega y se factura electrónicamente
5. **Cobro** → Cuentas por cobrar lo trackea hasta que se cierra

## Permisos importantes

- Solo **vendedores** y arriba pueden crear órdenes
- **Descuentos > 15%** requieren aprobación de gerente
- Cambios sobre órdenes ya despachadas requieren motivo + auditoría

## Clientes en 360°

En **Cliente 360°** ves toda la historia de un cliente: órdenes, pagos, tickets de soporte, garantías, score de churn (IA). Útil antes de una reunión comercial.

## Tip

Si un cliente aparece en **Clientes en riesgo** (el módulo de churn IA), tomá acción antes de mandar una cotización grande — puede que esté evaluando irse.
`,
  },
  {
    slug: 'stock',
    titulo: 'Stock e Inventario',
    categoria: 'core',
    resumen: 'Productos, niveles, movimientos',
    contenido: `# Stock

Maneja el catálogo de productos, niveles de inventario y movimientos.

## Productos

Cada producto tiene:
- **Código**: identificador único (SKU)
- **Descripción**
- **Categoría**
- **Stock actual** (calculado en tiempo real desde movimientos)
- **Stock mínimo** (para alertas)
- **Precio de venta + costo promedio**
- **Ubicación** (si usás WMS con almacenes)

## Movimientos

Cada cambio de stock genera un movimiento:
- **Entrada**: compra, devolución de cliente, ajuste positivo
- **Salida**: venta, consumo interno, ajuste negativo
- **Transferencia**: entre almacenes

Los movimientos son **inmutables**. Si te equivocaste, hacés un ajuste compensatorio (no editás el original). Esto es para auditabilidad.

## Reabastecimiento IA

Si querés ayuda decidiendo qué comprar y cuánto, andá a **Reabastecimiento IA** — usa EOQ (Economic Order Quantity) + ROP (Reorder Point) para optimizar capital.
`,
  },
  {
    slug: 'wms',
    titulo: 'WMS (Warehouse Management)',
    categoria: 'operaciones',
    resumen: 'Picking, packing, ubicaciones, despacho',
    contenido: `# WMS — Warehouse Management System

Gestiona las operaciones físicas del depósito.

## Conceptos

- **Almacén**: lugar físico (ej: "Depósito Central", "Bodega Norte")
- **Ubicación**: estantería/columna/nivel dentro de un almacén (ej: "A-12-3")
- **Reserva**: stock comprometido para una orden pero no despachado todavía
- **Picking**: armar los pedidos
- **Packing**: empaquetar
- **Despacho**: confirmar la salida

## Flujo típico

1. Vendedor crea orden de venta
2. Sistema reserva stock automáticamente
3. Bodeguero ve la lista de picking en su pantalla (priorizada por urgencia)
4. Marca cada ítem como picked al escanear/contar
5. Pasa a packing → se imprime el remito
6. Despacho confirma salida → genera movimiento + factura electrónica

## Tip

Activá las **ubicaciones físicas** (A-12-3) desde el principio, aunque al principio te parezca overkill. Cuando crezca el depósito, te va a ahorrar horas de buscar.
`,
  },
  {
    slug: 'pricing-ai',
    titulo: 'Pricing IA',
    categoria: 'analisis',
    resumen: 'Recomendaciones de precios basadas en elasticidad',
    contenido: `# Pricing IA

Usa **regresión log-log de demanda** para estimar la elasticidad-precio de cada producto y recomendar el precio óptimo que maximiza margen.

## ¿Cómo funciona?

1. Analiza tus ventas históricas
2. Por cada producto, agrupa transacciones por "nivel de precio"
3. Calcula la elasticidad (cuánto cae la demanda si subís el precio 1%)
4. Aplica la fórmula del precio óptimo de monopolio: **P\\* = costo × e/(e+1)**
5. Te muestra: precio actual, precio sugerido, impacto en margen anual

## Cuándo confiar

- ✅ Productos con **≥8 transacciones** y **≥2 niveles de precio distintos**
- ⚠️ Productos con poca historia → usa fallback de margen 40%
- ❌ Productos con elasticidad anómala (|e| > 10) → no se sugiere cambio

## Estados de recomendación

- **Subir**: el producto está infravalorado, el mercado paga más
- **Bajar**: el precio actual aleja demasiada demanda
- **Mantener**: estás cerca del óptimo

## Tip

No cambies precios todos los meses. Hacelo trimestralmente y monitoreá el impacto. El módulo te dice cuánto margen anual ganarías, ordenado por impacto descendente.
`,
  },
  {
    slug: 'replenishment',
    titulo: 'Reabastecimiento IA',
    categoria: 'analisis',
    resumen: 'Qué comprar y cuánto — optimiza capital',
    contenido: `# Reabastecimiento IA

Te dice **qué comprar, cuánto y cuándo** para no quedarte sin stock pero tampoco tener capital muerto en depósito.

## Modelo

- **EOQ (Economic Order Quantity)**: cantidad óptima de pedido = √(2·D·S/H)
  - D = demanda anual
  - S = costo fijo por orden de compra
  - H = costo de mantener una unidad en stock durante un año
- **ROP (Reorder Point)**: nivel de stock al que tenés que disparar el reorden = demanda·leadtime + stock_seguridad
- **Stock de seguridad**: 1.28·σ·√leadtime (90% service level — conservador, para no comprar de más)

## Tres estados por producto

- 🟢 **Mantener**: stock OK, no hacer nada
- 🟡 **Comprar**: stock cerca del ROP → pedir EOQ unidades al proveedor
- 🔴 **Reducir**: cobertura > 90 días, o stock muerto sin movimiento → liquidar

## Urgencia

- **Crítica**: días hasta stockout ≤ leadtime/2
- **Alta**: stockout entre leadtime/2 y leadtime
- **Media/baja**: tenés tiempo

## Tip

El módulo está calibrado para **optimizar capital** — prefiere quedarse corto de stock a sobrar. Si tu negocio prefiere tener siempre stock buffer, podés ajustar el service level (default 90%) en el código.
`,
  },
  {
    slug: 'asistente-ia',
    titulo: 'Asistente IA Omnisciente',
    categoria: 'analisis',
    resumen: 'Chat con IA que entiende tu negocio',
    contenido: `# Asistente IA

Es un chat (botón flotante abajo a la derecha) que entiende lenguaje natural y puede:

- **Consultar datos**: "¿cuánto vendí este mes?", "¿hay stock de SKU-123?"
- **Hacer cálculos**: "¿cuál es mi margen del trimestre?"
- **Crear cosas** (con permisos): "creame una cotización para Acme por 50 unidades del producto X"
- **Explicar conceptos**: "¿qué es DSO?", "¿cómo funciona el ROP?"
- **Guiarte por la app**: "¿dónde veo las facturas vencidas?"

## Permisos

El asistente respeta tu rol:
- Vendedor solo puede ver/crear cosas comerciales
- Admin puede todo
- Si pedís algo que tu rol no permite, te lo dice

## Tip

Todas las respuestas quedan en tu **historial de sesión** (lateral del chat). Si pedís un cálculo importante, podés volver a verlo después.
`,
  },
  {
    slug: 'customer-risk',
    titulo: 'Clientes en Riesgo (Churn IA)',
    categoria: 'postventa',
    resumen: 'Detección temprana de clientes que están por irse',
    contenido: `# Clientes en Riesgo

Combina **ML (XGBoost)** + **LLM (análisis de emails)** para identificar clientes con alta probabilidad de churn antes de que se vayan.

## ¿Cómo lo calcula?

### Score numérico (XGBoost)
Entrena con 13 features de tu DB:
- Recencia de última compra
- Frecuencia de compras
- Ticket promedio vs histórico
- Reclamos en últimos 90 días
- RMAs (devoluciones)
- Tickets de soporte sin resolver
- Facturas vencidas
- Garantías activas
- etc.

Output: **probabilidad de churn en los próximos 90 días (0 a 100%)**.

### Análisis cualitativo (LLM)
Si tenés postsale-mvp conectado, lee los emails de los últimos N días con el cliente y extrae:
- Sentimiento (positivo/neutro/negativo)
- Quejas recurrentes
- Señales explícitas ("evaluando alternativas", "no respondieron")
- Razones cualitativas del posible churn

## Niveles de riesgo

- 🔴 **Crítico**: ≥75% probabilidad — acción urgente
- 🟠 **Alto**: ≥50% — call de retención
- 🟡 **Medio**: ≥25% — monitorear
- 🟢 **Bajo**: <25%

## Entrenamiento

El modelo se re-entrena con el botón **Reentrenar**. Necesitás al menos **30 clientes con historia** para entrenar.

## Tip

Cuando un cliente entra en crítico, **no le mandes un descuento de inmediato**. Llamá, entendé qué pasa. Muchas veces es un problema operativo (un reclamo no resuelto) y no de precio.
`,
  },
  {
    slug: 'aprobaciones',
    titulo: 'Aprobaciones',
    categoria: 'sistema',
    resumen: 'Workflow de autorizaciones',
    contenido: `# Aprobaciones

Algunas operaciones requieren autorización de un superior antes de ejecutarse. Esto se llama **flujo de aprobación**.

## Casos típicos

- Descuentos > 15%
- Órdenes de compra > monto X
- Cambios sobre órdenes ya despachadas
- Modificaciones a precios de catálogo
- Anulación de facturas

## Cómo funciona

1. El sistema detecta una operación que requiere aprobación
2. Se crea una **solicitud** que queda pendiente
3. Se notifica a los autorizadores correspondientes
4. El autorizador aprueba (con motivo) o rechaza (con motivo)
5. Si aprueba → la operación se ejecuta
6. Todo queda en **auditoría** (quién aprobó, cuándo, motivo)

## Reglas de autorización

Se configuran en *Configuración → Reglas de aprobación*. Por ejemplo:
- "Descuentos entre 15% y 30% → aprueba supervisor de ventas"
- "Descuentos > 30% → aprueba gerente comercial"

## Tip

Diseñá las reglas con criterio. Si todo requiere aprobación, los gerentes se vuelven cuello de botella. Si nada lo requiere, perdés control.
`,
  },
  {
    slug: 'multi-tenant',
    titulo: 'Multi-empresa (Multi-tenant)',
    categoria: 'sistema',
    resumen: 'Trabajar con varias empresas desde una instancia',
    contenido: `# Multi-empresa

Vanguard soporta **multi-tenant**: una sola instancia puede manejar varias empresas (organizaciones) con datos completamente aislados.

## Cómo se ve

Arriba del sidebar tenés un selector con tu empresa activa. Cliqueando ahí podés:
- Cambiar a otra empresa que tenés acceso
- Crear una nueva empresa

## Aislamiento

Cada registro de cada tabla está atado a una \`organizacion_id\`. Las queries del sistema filtran automáticamente por la organización activa. Nadie puede ver datos de otra empresa, ni siquiera por error.

Esto se enforza en 3 niveles:
1. **Frontend**: queries usan \`tenantSelect()\` que injecta el filter
2. **Backend**: middleware valida el contexto en cada API
3. **Database**: Row-Level Security (RLS) en Supabase como red de seguridad

## Casos de uso

- **Contador con varios clientes**: una instancia, una empresa por cliente
- **Holding con varias unidades**: cada UN es una organización
- **SaaS multitenant**: ofrecer Vanguard a múltiples PyMEs sin duplicar infraestructura

## Tip

Si vas a usar multi-tenant en producción, **verificá las RLS policies en Supabase** antes de invitar usuarios. Sin RLS bien configurada, los datos podrían filtrarse entre empresas.
`,
  },
  {
    slug: 'seguridad',
    titulo: 'Seguridad y Auditoría',
    categoria: 'sistema',
    resumen: 'Audit log, 2FA, GDPR, encriptación',
    contenido: `# Seguridad

Vanguard incorpora seguridad enterprise-grade:

## Auditoría inmutable (hash chain)

Cada acción importante (crear orden, modificar precio, exportar datos) genera un registro en \`auditoria\` con:
- Usuario, IP, user-agent
- Datos antes/después
- Timestamp
- **Hash encadenado**: cada entry incluye el hash del anterior

Esto significa que si alguien intentara borrar o alterar un registro del medio, la cadena se rompe y se detecta inmediatamente.

## 2FA para acciones críticas

Los admins pueden activar 2FA (Google Authenticator) para protegerse. Cuando un admin exporta o borra datos de **otro usuario** (GDPR), el sistema le pide un código TOTP.

Para activarlo: \`POST /api/auth/2fa/enroll\` → escanear QR → \`POST /api/auth/2fa/verify\`.

## Encriptación de PII

Datos personales (email, teléfono, nombre) se encriptan en la DB con AES-256-GCM. La key está en \`PII_ENCRYPTION_KEY\` (variable de entorno).

## GDPR / Ley 18.331 UY

- **Export**: cualquier usuario puede pedir todos sus datos en JSON
- **Borrado**: solicitud que un admin procesa; algunos datos legales (facturas) se anonimizan pero no se borran
- **Audit log**: cada export/borrado queda registrado

## Rate limiting

Endpoints sensibles tienen límite de requests por hora/usuario para prevenir abuso.

## Tip

Activá 2FA para todos los admins **antes** de que tengan datos sensibles cargados. Es mucho más fácil hacerlo ahora que después.
`,
  },
];

export function getDocBySlug(slug: string): DocSection | undefined {
  return docs.find(d => d.slug === slug);
}

export function getDocsByCategoria(categoria: DocSection['categoria']): DocSection[] {
  return docs.filter(d => d.categoria === categoria);
}

export function buscarDocs(query: string): DocSection[] {
  const q = query.toLowerCase().trim();
  if (!q) return docs;
  return docs.filter(d =>
    d.titulo.toLowerCase().includes(q) ||
    d.resumen.toLowerCase().includes(q) ||
    d.contenido.toLowerCase().includes(q)
  );
}
