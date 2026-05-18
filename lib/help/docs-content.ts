// =====================================================
// Contenido del centro de ayuda de Vanguard
// =====================================================
// Los docs viven inline en TS porque:
//   1. Cero config de webpack (no necesita raw-loader)
//   2. TypeScript valida que cada slug exista
//   3. Más rápido el bundle (no extra fetches)
//
// Cobertura: TODOS los módulos del sidebar + un mapa de
// flujos que muestra cómo se conectan entre sí.
// =====================================================

export interface DocSection {
  slug: string;
  titulo: string;
  categoria: 'inicio' | 'nucleo' | 'operaciones' | 'analisis' | 'postventa' | 'sistema';
  resumen: string;
  /** Nombre del icono Lucide (lucide-react). Ver components/ayuda/icon-registry.ts */
  icon: string;
  contenido: string;
}

export const docs: DocSection[] = [
  // ===================================================
  // INICIO
  // ===================================================
  {
    slug: 'getting-started',
    icon: 'Rocket',
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
- **Auditoría**: todo lo que pasa queda registrado en un log inmutable.
- **IA Omnisciente**: un asistente que entiende lenguaje natural y consulta/modifica datos por vos.

## Atajos útiles

| Acción | Atajo |
|---|---|
| Abrir asistente IA | Botón flotante abajo a la derecha |
| Cambiar empresa | Header → selector arriba del sidebar |
| Cambiar idioma | Header → bandera |
| Centro de Ayuda | Sidebar → Configuración → Centro de Ayuda |

## Siguiente paso

Mirá el **Mapa de Módulos** para entender cómo se conectan todas las piezas del sistema.
`,
  },
  {
    slug: 'mapa-modulos',
    icon: 'Network',
    titulo: 'Mapa de Módulos — Cómo se conectan',
    categoria: 'inicio',
    resumen: 'Vista global de los flujos del sistema y cómo encaja cada módulo',
    contenido: `# Mapa de Módulos

Vanguard no son módulos sueltos: todo está conectado. Cuando creás una venta, **automáticamente** se reserva stock, se asigna picking, se genera factura, se crea cuenta por cobrar y se contabiliza. Acá te muestro los **5 flujos principales** y qué módulos intervienen.

## Flujo 1: Venta (de la cotización al cobro)

\`\`\`
Comercial → Stock/WMS → Facturación → Finanzas → Auditoría
\`\`\`

1. **Comercial**: vendedor crea cotización → cliente acepta → se convierte en orden de venta
2. **Stock**: el sistema reserva las unidades automáticamente (no las descuenta todavía)
3. **WMS**: bodeguero ve la lista de picking, prepara y empaqueta
4. **Facturación electrónica**: se genera CFE (UY) y se envía a DGI
5. **Finanzas**: se crea la cuenta por cobrar
6. **Stock**: al despachar, se descuenta el stock realmente
7. **Auditoría**: cada paso queda registrado con hash chain inmutable

## Flujo 2: Compra (del pedido a la recepción)

\`\`\`
Reabastecimiento IA → Compras → Aprobaciones → Stock/WMS → QMS → Finanzas
\`\`\`

1. **Reabastecimiento IA** sugiere qué comprar (EOQ + ROP)
2. **Compras**: se genera orden de compra al proveedor
3. **Aprobaciones**: si supera monto X, requiere autorización
4. **WMS**: bodega recibe la mercadería en muelle
5. **QMS**: control de calidad — si pasa, ingresa a stock; si no, queda en cuarentena
6. **Stock**: se generan movimientos de entrada
7. **Finanzas**: cuenta por pagar al proveedor

## Flujo 3: Post-venta (cliente reporta problema)

\`\`\`
Tickets → Garantías/Taller → Stock → RMA → Comercial
\`\`\`

1. **Tickets**: cliente abre reclamo de soporte
2. **Garantías**: sistema chequea si está cubierto
3. **Taller**: si requiere reparación, se crea orden de trabajo
4. **Stock**: se descuentan repuestos
5. **RMA**: si hay que devolver al proveedor por defecto de fábrica
6. **Comercial**: queda registrado en el historial del cliente

## Flujo 4: Producción (BOM + Ensamblaje)

\`\`\`
BOM → Ensamblajes → Stock → Trazabilidad
\`\`\`

1. **BOM**: definís la fórmula del producto terminado (qué materias primas lleva)
2. **Ensamblajes**: orden de producción consume materias primas y genera producto terminado
3. **Stock**: bajan las materias primas, sube el producto terminado
4. **Trazabilidad**: si usás seriales/lotes, queda registrado qué lote de cada materia prima generó qué lote de producto

## Flujo 5: Análisis (IA toma decisiones)

\`\`\`
Stock + Comercial + Tickets → Customer Risk / Pricing AI / Reabastecimiento → Acciones
\`\`\`

1. **IA lee los datos** de ventas, stock, soporte
2. **Customer Risk** predice qué clientes están por irse
3. **Pricing AI** sugiere precios óptimos
4. **Reabastecimiento IA** dice qué comprar
5. **Demand Planning** proyecta demanda futura
6. **Asistente IA** te explica todo en lenguaje natural

## El "pegamento" del sistema

Tres módulos conectan todo:

- **Aprobaciones**: cualquier operación que excede límites pasa por acá
- **Auditoría**: cada acción queda registrada (quién, cuándo, qué cambió)
- **Notificaciones**: te avisa de eventos importantes (chat in-app)

## Tip

Antes de configurar reglas complejas, hacé el flujo más simple end-to-end (una venta de prueba completa). Vas a entender mejor cómo encajan las piezas.
`,
  },

  // ===================================================
  // NÚCLEO DEL NEGOCIO
  // ===================================================
  {
    slug: 'dashboard',
    icon: 'LayoutDashboard',
    titulo: 'Dashboard',
    categoria: 'nucleo',
    resumen: 'Vista general del estado del negocio',
    contenido: `# Dashboard

La primera pantalla que ves al entrar. Estado general del negocio en tiempo real.

## ¿Qué mide?

- **Ventas del período**: facturación acumulada (mes/trimestre)
- **Stock crítico**: cuántos productos están por debajo del mínimo
- **Pedidos pendientes**: órdenes que esperan picking, despacho o facturación
- **Cuentas por cobrar**: cuánto te deben los clientes
- **Alertas**: aprobaciones pendientes, vencimientos, etc.

## Conexiones

- Lee de **Comercial** (ventas, cotizaciones)
- Lee de **Stock** (niveles, alertas)
- Lee de **Finanzas** (cuentas por cobrar)
- Lee de **Aprobaciones** (pendientes)

## Tip

Si querés métricas más financieras (margen, DSO, EBITDA), andá a **Vista Ejecutiva**.
`,
  },
  {
    slug: 'executive',
    icon: 'Briefcase',
    titulo: 'Vista Ejecutiva (C-Level)',
    categoria: 'nucleo',
    resumen: 'KPIs financieros para gerencia y dueños',
    contenido: `# Vista Ejecutiva

Diseñada para **CEO, CFO y socios**. Indicadores estratégicos.

## KPIs principales

- **Ingresos**: facturación del período vs anterior
- **Margen bruto**: cuánto ganás después del costo de productos
- **DSO (Days Sales Outstanding)**: cuántos días tardás en cobrar
- **Cuentas por cobrar**: total adeudado por clientes
- **Aprobaciones pendientes**: cosas esperando tu firma

## Selector de período

- **MTD** (mes corriente), **QTD** (trimestre), **YTD** (año), **12M** (últimos 12 meses)

## Conexiones

- Cruza datos de **Finanzas + Comercial + Stock + Costos**
- Recibe alertas de **Aprobaciones**

## Tip

Mirá la tendencia del **margen %**. Si baja consistentemente, algo está pasando: subieron costos, das muchos descuentos, o cambió el mix.
`,
  },
  {
    slug: 'stock',
    icon: 'Package',
    titulo: 'Stock e Inventario',
    categoria: 'nucleo',
    resumen: 'Productos, niveles, alertas',
    contenido: `# Stock

Maneja el catálogo de productos y niveles de inventario.

## Productos

Cada producto tiene:
- **Código (SKU)**, **descripción**, **categoría**
- **Stock actual** (calculado desde movimientos)
- **Stock mínimo** (para alertas)
- **Precio de venta + costo promedio**
- **Ubicación** (si usás WMS)

## Conexiones

- **Movimientos**: cada cambio genera registro
- **Comercial**: las ventas descuentan stock
- **Compras**: las recepciones suman stock
- **WMS**: maneja ubicaciones físicas
- **BOM/Ensamblajes**: las producciones consumen materias y suman terminados
- **Seriales/Trazabilidad**: por número de serie o lote
- **Reabastecimiento IA**: usa estos datos para sugerir compras

## Tip

Cargá **stock mínimo y máximo** desde el principio. Es la base para que el sistema te avise antes de quedar sin stock.
`,
  },
  {
    slug: 'movimientos',
    icon: 'ArrowLeftRight',
    titulo: 'Movimientos',
    categoria: 'nucleo',
    resumen: 'Historial inmutable de cambios de inventario',
    contenido: `# Movimientos

Cada cambio de stock genera un **movimiento** inmutable.

## Tipos

- **Entrada**: compra, devolución de cliente, ajuste positivo
- **Salida**: venta, consumo interno, ajuste negativo
- **Transferencia**: entre almacenes

## Inmutabilidad

Los movimientos **no se editan ni se borran**. Si te equivocaste, hacés un ajuste compensatorio. Esto es para auditoría — siempre podés reconstruir el inventario en cualquier momento del pasado.

## Conexiones

- **Stock**: el saldo de cada producto se calcula sumando/restando movimientos
- **Comercial**: cada venta despachada genera salida
- **Compras**: cada recepción genera entrada
- **Almacenes**: las transferencias tienen origen + destino
- **Auditoría**: todo queda registrado con hash chain

## Tip

Si tu stock está "raro" (no coincide con lo físico), filtrá movimientos del último mes para detectar el error. Hacé el ajuste con motivo claro — queda auditado.
`,
  },
  {
    slug: 'comercial',
    icon: 'ShoppingCart',
    titulo: 'Comercial / Ventas',
    categoria: 'nucleo',
    resumen: 'Cotizaciones, órdenes de venta, clientes',
    contenido: `# Comercial

Ciclo comercial completo desde cotización hasta facturación.

## Flujo

1. **Cliente pide cotización** → vendedor crea cotización
2. **Cliente acepta** → cotización → orden de venta
3. **Bodega prepara** → picking + packing en WMS
4. **Despacho** → entrega + facturación electrónica
5. **Cobro** → cuentas por cobrar lo trackea hasta que cierra

## Permisos

- Solo **vendedores+** crean órdenes
- **Descuentos > 15%** requieren aprobación de gerente
- Cambios sobre órdenes ya despachadas requieren motivo

## Conexiones

- **Stock**: reserva y descuenta inventario
- **WMS**: dispara picking
- **Facturación electrónica**: genera CFE
- **Finanzas**: crea cuenta por cobrar
- **Cliente 360°**: aparece en el historial
- **Pricing AI**: puede sugerir precio óptimo
- **Customer Risk**: alerta si el cliente está en riesgo

## Tip

Si un cliente aparece en **Clientes en Riesgo**, tomá acción antes de mandar una cotización grande — puede que esté evaluando irse.
`,
  },
  {
    slug: 'compras',
    icon: 'Truck',
    titulo: 'Compras',
    categoria: 'nucleo',
    resumen: 'Órdenes de compra, recepción, proveedores',
    contenido: `# Compras

Manejá el ciclo de compras: del pedido al proveedor a la recepción en bodega.

## Flujo

1. **Reabastecimiento IA** te sugiere qué comprar (opcional)
2. Generás **orden de compra** al proveedor
3. Si supera monto X → pasa por **Aprobaciones**
4. El proveedor confirma + envía mercadería
5. **Recepción** en bodega genera movimiento de entrada
6. **QMS** valida calidad si está configurado
7. **Finanzas** crea cuenta por pagar

## Conexiones

- **Proveedores**: catálogo + datos fiscales
- **Stock**: recepción suma inventario
- **WMS**: ubicación física al recibir
- **QMS**: control de calidad en recepción
- **RMA**: si hay defectos, se devuelve al proveedor
- **Finanzas**: cuenta por pagar + asiento contable
- **Aprobaciones**: según monto y tipo

## Tip

Cargá los **lead times** de cada proveedor. Reabastecimiento IA los usa para calcular el ROP (Reorder Point) correcto y evitarte stockouts.
`,
  },
  {
    slug: 'finanzas',
    icon: 'Wallet',
    titulo: 'Finanzas',
    categoria: 'nucleo',
    resumen: 'Cuentas por cobrar, por pagar, conciliación',
    contenido: `# Finanzas

Centraliza la salud financiera: lo que te deben, lo que debés, los movimientos bancarios.

## Funcionalidades

- **Cuentas por cobrar (AR)**: facturas emitidas pendientes de cobro
- **Cuentas por pagar (AP)**: facturas de proveedores pendientes de pago
- **Conciliación bancaria**: match entre extracto del banco y registros del sistema
- **Asientos contables**: registros de doble partida
- **Aging report**: facturas vencidas por antigüedad (0-30, 31-60, 61-90, >90)

## Conexiones

- **Comercial**: cada factura emitida crea cuenta por cobrar
- **Compras**: cada factura recibida crea cuenta por pagar
- **Facturación electrónica**: las CFEs emitidas sincronizan acá
- **Vista Ejecutiva**: alimenta KPIs de DSO y cash flow
- **Auditoría**: cada movimiento registrado

## Tip

Revisá el **aging report** semanalmente. Las facturas que pasan 60 días sin cobrar tienen probabilidad alta de no cobrarse — actuá antes.
`,
  },
  {
    slug: 'reportes',
    icon: 'FileBarChart',
    titulo: 'Reportes',
    categoria: 'nucleo',
    resumen: 'Exportación de datos a Excel y PDF',
    contenido: `# Reportes

Generá reportes de cualquier tabla del sistema en Excel o PDF.

## Reportes pre-armados

- Ventas por vendedor / cliente / producto / período
- Stock valorizado
- Movimientos de inventario
- Cuentas por cobrar/pagar con aging
- Margen por producto
- Comisiones de vendedores

## Conexiones

- Lee de **todos los módulos** transversalmente
- Respeta permisos: solo ves lo que tu rol permite
- Exports quedan registrados en **Auditoría**

## Tip

Si necesitás un reporte que no existe, usá el **Asistente IA**: "Mostrame las ventas de María del último trimestre por cliente". Después podés pedirle que lo exporte.
`,
  },
  {
    slug: 'costos',
    icon: 'Calculator',
    titulo: 'Costos',
    categoria: 'nucleo',
    resumen: 'Costeo de productos y análisis de rentabilidad',
    contenido: `# Costos

Manejá costos de productos y analizá rentabilidad real.

## Métodos de costeo

- **Promedio ponderado**: costo unitario = (stock_valor + nueva_compra) / total_unidades
- **FIFO**: primer entrado, primer salido
- **Costo estándar**: definís un costo fijo

## Conexiones

- **Stock**: cada producto tiene su costo asociado
- **Compras**: actualiza costo cuando llega mercadería a precio nuevo
- **Comercial**: margen = precio venta - costo
- **BOM**: costo del producto terminado = suma de costos de materias primas
- **Vista Ejecutiva**: alimenta el margen bruto

## Tip

Si usás materias importadas con tipo de cambio volátil, considerá actualizar costos más seguido. Sino el margen reportado puede ser engañoso.
`,
  },

  // ===================================================
  // OPERACIONES
  // ===================================================
  {
    slug: 'wms',
    icon: 'Warehouse',
    titulo: 'WMS — Warehouse Management',
    categoria: 'operaciones',
    resumen: 'Picking, packing, ubicaciones, despacho',
    contenido: `# WMS

Operaciones físicas del depósito.

## Conceptos

- **Almacén**: lugar físico (ej: "Depósito Central")
- **Ubicación**: estantería/columna/nivel (ej: "A-12-3")
- **Reserva**: stock comprometido pero no despachado
- **Picking → Packing → Despacho**: el flujo de armado

## Flujo

1. Orden de venta crea reserva automática
2. Bodeguero ve lista de picking priorizada
3. Marca items como picked (escaneo o conteo)
4. Pasa a packing → imprime remito
5. Despacho confirma → genera movimiento + factura

## Conexiones

- **Comercial**: recibe órdenes a preparar
- **Stock/Movimientos**: confirma salida
- **Almacenes**: dónde está cada cosa
- **Seriales**: si trackeás por número de serie
- **Facturación**: dispara CFE al despachar

## Tip

Activá **ubicaciones físicas** desde el principio. Cuando el depósito crece, te ahorra horas de búsqueda.
`,
  },
  {
    slug: 'almacenes',
    icon: 'Building2',
    titulo: 'Almacenes',
    categoria: 'operaciones',
    resumen: 'Múltiples depósitos físicos',
    contenido: `# Almacenes

Si tenés más de un depósito (sucursal, bodega regional, vehículo de reparto), los configurás acá.

## Funcionalidades

- Crear/editar almacenes
- Definir **ubicaciones** dentro de cada almacén (A-12-3)
- Ver **stock por almacén** (un producto puede estar en varios)
- **Transferencias** entre almacenes

## Conexiones

- **Stock**: cada producto tiene saldo por almacén
- **WMS**: las operaciones físicas usan estas ubicaciones
- **Movimientos**: las transferencias generan salida + entrada
- **Reabastecimiento IA**: puede sugerir transferir antes de comprar

## Tip

Si tenés vehículos de reparto, manejalos como almacenes móviles. Carga lo que sale → entrega → confirma. Sabés siempre qué hay en cada camión.
`,
  },
  {
    slug: 'facturacion',
    icon: 'Receipt',
    titulo: 'Facturación Electrónica',
    categoria: 'operaciones',
    resumen: 'CFE para DGI Uruguay',
    contenido: `# Facturación Electrónica

Generación de **Comprobantes Fiscales Electrónicos (CFE)** para la DGI de Uruguay.

## Tipos soportados

- e-Factura (B2B)
- e-Ticket (B2C)
- e-Boleta de contado
- e-Nota de crédito / débito
- e-Remito

## Flujo

1. Comercial genera factura
2. Sistema crea XML CFE firmado digitalmente
3. Se envía a DGI vía API
4. DGI devuelve CAE (Código de Autorización Electrónico)
5. Se genera PDF para el cliente
6. Si rechaza, queda en cola con motivo del error

## Conexiones

- **Comercial**: dispara la facturación
- **Finanzas**: actualiza cuenta por cobrar
- **Auditoría**: cada CFE queda con su número y CAE
- **Cliente 360°**: aparece en el historial fiscal

## Tip

Configurá los **certificados digitales** y datos del emisor antes de empezar. Si la DGI rechaza un CFE, no podés mandarlo de nuevo con el mismo número.
`,
  },
  {
    slug: 'clientes-360',
    icon: 'UserCircle2',
    titulo: 'Cliente 360°',
    categoria: 'operaciones',
    resumen: 'Vista completa de cada cliente',
    contenido: `# Cliente 360°

Toda la información de un cliente en una sola pantalla.

## ¿Qué muestra?

- **Datos fiscales** (RUT, dirección)
- **Historial de órdenes** (cotizaciones, ventas, montos)
- **Estado de cuenta**: facturas vencidas, pagos
- **Tickets de soporte** abiertos/cerrados
- **Garantías activas**
- **Score de churn** (Customer Risk IA)
- **Última interacción** (call, email, reunión)

## Conexiones

- Agregador de **Comercial + Finanzas + Tickets + Garantías + Customer Risk + RMA**
- Lee del **historial de actividad**

## Tip

Antes de cualquier reunión comercial importante, abrí el Cliente 360°. Ver el churn score + tickets abiertos te evita reuniones incómodas.
`,
  },
  {
    slug: 'taller',
    icon: 'Wrench',
    titulo: 'Taller',
    categoria: 'operaciones',
    resumen: 'Órdenes de trabajo, técnicos, reparaciones',
    contenido: `# Taller

Gestión del taller de servicio técnico.

## Flujo

1. Cliente trae equipo / reporta falla (Tickets)
2. Recepción crea **orden de trabajo (OT)**
3. Se asigna técnico
4. Técnico diagnóstica y solicita repuestos
5. Stock descarga los repuestos
6. Se prueba + factura

## Funcionalidades

- Asignación por técnico (con carga horaria)
- Tracking de tiempos por OT
- Garantías: si está dentro, no se factura mano de obra
- Histórico de equipos por cliente

## Conexiones

- **Tickets**: origen del reclamo
- **Garantías**: chequea cobertura
- **Stock**: descuenta repuestos
- **RMA**: si la pieza viene defectuosa de fábrica
- **Comercial**: factura mano de obra + repuestos
- **Cliente 360°**: histórico de servicios

## Tip

Trackeá el **tiempo real de cada OT** vs el estimado. Si los técnicos siempre tardan más, el costeo del servicio está mal y perdés plata.
`,
  },
  {
    slug: 'proyectos',
    icon: 'Kanban',
    titulo: 'Proyectos',
    categoria: 'operaciones',
    resumen: 'Trabajos con múltiples etapas (kanban)',
    contenido: `# Proyectos

Para trabajos complejos con varias etapas (instalaciones, obras, integraciones).

## Funcionalidades

- Vista **kanban** (etapas: pendiente → en progreso → revisión → entregado)
- Tareas con responsables y fechas
- Costos asociados (materiales + horas)
- Vinculación a cotización / orden de venta

## Conexiones

- **Comercial**: el proyecto puede venir de una cotización aceptada
- **Stock**: materiales asignados al proyecto
- **Taller**: horas de técnicos
- **Costos**: rentabilidad del proyecto entero
- **Finanzas**: facturación parcial por etapa

## Tip

Para proyectos largos (>30 días) facturá por hitos, no al final. Mejora tu cash flow.
`,
  },
  {
    slug: 'bom',
    icon: 'Boxes',
    titulo: 'BOM (Lista de Materiales)',
    categoria: 'operaciones',
    resumen: 'Fórmulas de productos terminados',
    contenido: `# BOM — Bill of Materials

Si fabricás o ensamblás productos, acá definís la **fórmula** de cada uno.

## Concepto

Un producto terminado se compone de **N materias primas/componentes**, cada uno con su **cantidad** y **merma esperada**.

Ej: 1 silla = 4 patas + 1 asiento + 6 tornillos + 0.5 litros de barniz

## Funcionalidades

- BOM multinivel (un componente puede ser a su vez producto compuesto)
- Versionado: cambios en fórmulas con fecha de vigencia
- Costeo automático: costo terminado = suma de costos de componentes

## Conexiones

- **Ensamblajes**: usa el BOM para descontar materias y producir terminado
- **Stock**: define qué productos son "compuestos"
- **Costos**: calcula el costo del producto terminado
- **Reabastecimiento IA**: si querés producir X, sabe cuánta materia necesitás

## Tip

Cargá la **merma esperada**. Si vas a usar 4.2 patas para hacer 1 silla en promedio (rotura, scrap), poné 5% de merma — sino el costo está mal.
`,
  },
  {
    slug: 'ensamblajes',
    icon: 'Cog',
    titulo: 'Ensamblajes',
    categoria: 'operaciones',
    resumen: 'Órdenes de producción',
    contenido: `# Ensamblajes

Ejecuta la producción según el BOM definido.

## Flujo

1. Generás **orden de producción** (cuántas unidades del producto terminado)
2. Sistema reserva las materias primas del BOM
3. Producción consume → bajan materias del stock
4. Al finalizar → sube stock del producto terminado
5. Si hay merma extra, se registra

## Conexiones

- **BOM**: define qué consumir
- **Stock**: descuenta materias, suma terminados
- **Movimientos**: genera entrada (terminado) + salida (materias)
- **Trazabilidad**: si usás lotes, vincula qué lote de materia generó qué lote de terminado
- **Costos**: actualiza costo del terminado

## Tip

Para productos con pocos componentes (<5) es viable. Para productos con BOM de 100+ componentes y subensambles, probablemente necesites un MRP dedicado.
`,
  },

  // ===================================================
  // ANÁLISIS E IA
  // ===================================================
  {
    slug: 'analytics',
    icon: 'TrendingUp',
    titulo: 'Analytics',
    categoria: 'analisis',
    resumen: 'Análisis avanzado, predicciones, anomalías',
    contenido: `# Analytics

Dashboard analítico con ML para encontrar patrones que se te escapan.

## Funcionalidades

- **Predicciones de demanda** por producto (próximas 4 semanas)
- **Detección de anomalías**: ventas inusualmente altas/bajas
- **Sugerencias de categorización**: si tenés productos sin categoría, IA propone
- **Pareto análisis**: el 20% de productos que genera el 80% del revenue

## Conexiones

- Lee de **Stock + Comercial + Movimientos**
- Alimenta **Demand Planning** con predicciones
- Sugerencias se aplican a **Stock** (categorías)

## Tip

Si Analytics te dice que un producto está vendiendo X veces más que su promedio, **revisá si tenés stock suficiente** antes de que se vuelva un stockout.
`,
  },
  {
    slug: 'pricing-ai',
    icon: 'Sparkles',
    titulo: 'Pricing IA',
    categoria: 'analisis',
    resumen: 'Recomendaciones de precios por elasticidad',
    contenido: `# Pricing IA

Usa **regresión log-log** para estimar elasticidad-precio y recomendar precios óptimos.

## ¿Cómo funciona?

1. Analiza ventas históricas
2. Por producto: agrupa transacciones por nivel de precio
3. Calcula elasticidad
4. Aplica precio óptimo de monopolio: **P\\* = costo × e/(e+1)**
5. Muestra: precio actual, sugerido, impacto en margen anual

## Estados

- **Subir**: producto infravalorado
- **Bajar**: precio aleja demasiada demanda
- **Mantener**: cerca del óptimo

## Cuándo confiar

- - OK: ≥8 transacciones y ≥2 niveles de precio
- Atención: Poca historia → fallback margen 40%
- - Excluido: Elasticidad |e|>10 → no se sugiere

## Conexiones

- Lee de **Comercial + Stock + Costos**
- Las recomendaciones se aplican en **Stock** (precio de venta)
- Impacto reflejado en **Vista Ejecutiva** (margen)

## Tip

No cambies precios todos los meses. Trimestral. Y monitoreá impacto vs predicción.
`,
  },
  {
    slug: 'replenishment',
    icon: 'RefreshCw',
    titulo: 'Reabastecimiento IA',
    categoria: 'analisis',
    resumen: 'Qué comprar y cuánto — optimiza capital',
    contenido: `# Reabastecimiento IA

Te dice **qué comprar, cuánto y cuándo** para no tener stockouts pero tampoco capital muerto.

## Modelo

- **EOQ**: cantidad óptima = √(2·D·S/H)
- **ROP**: nivel de reorden = demanda·leadtime + stock_seguridad
- **Stock seguridad**: 1.28·σ·√leadtime (90% service level)

## Estados

- �**Mantener**: stock OK
- �**Comprar**: cerca del ROP → pedir EOQ
- �**Reducir**: cobertura > 90 días → liquidar

## Urgencia

- **Crítica**: días hasta stockout ≤ leadtime/2
- **Alta/Media/Baja**

## Conexiones

- Lee de **Stock + Movimientos + Compras** (leadtime de proveedor)
- Una sugerencia → genera **Orden de Compra**
- Vinculado con **Demand Planning** (predicción de demanda)

## Tip

Calibrado para **optimizar capital** — prefiere quedarse corto. Si tu negocio prefiere buffer, ajustá service level.
`,
  },
  {
    slug: 'demand-planning',
    icon: 'Activity',
    titulo: 'Demand Planning',
    categoria: 'analisis',
    resumen: 'Proyección de demanda futura',
    contenido: `# Demand Planning

Proyecta la demanda de cada producto en las próximas semanas/meses.

## Modelo

Combina:
- **Histórico**: tendencia de los últimos 12 meses
- **Estacionalidad**: si vendés más en ciertos meses
- **Eventos**: promociones, lanzamientos
- **Cliente**: si tenés contratos con consumo recurrente

## Outputs

- Forecast por producto (próximas N semanas)
- Banda de confianza (escenario optimista/pesimista)
- Quiebres detectados (productos con cambio de tendencia)

## Conexiones

- Alimenta **Reabastecimiento IA** (cuánto comprar)
- Cruza con **Stock** para ver si vas a quedar corto
- Visible en **Vista Ejecutiva** como forecast de ingresos

## Tip

Compará forecast vs real cada mes. Si el forecast siempre se equivoca para arriba o abajo, hay un sesgo y conviene re-entrenar el modelo con más data reciente.
`,
  },
  {
    slug: 'asistente-ia',
    icon: 'Bot',
    titulo: 'Asistente IA Omnisciente',
    categoria: 'analisis',
    resumen: 'Chat con IA que entiende tu negocio',
    contenido: `# Asistente IA

Chat (botón flotante abajo a la derecha) que entiende lenguaje natural y puede:

- **Consultar**: "¿cuánto vendí este mes?", "¿hay stock de SKU-123?"
- **Calcular**: "¿cuál es mi margen del trimestre?"
- **Crear** (con permisos): "creame cotización para Acme por 50 X"
- **Explicar**: "¿qué es DSO?", "¿cómo funciona el ROP?"
- **Guiar**: "¿dónde veo las facturas vencidas?"

## Permisos

Respeta tu rol. Si pedís algo que no podés hacer, te lo dice.

## Conexiones

- Tiene acceso a **TODOS los módulos** (Stock, Comercial, Compras, Finanzas, WMS, etc.)
- Las acciones quedan en **Auditoría**
- Las consultas no escriben nada

## Tip

Si pedís un cálculo importante, podés volver a verlo en el **historial de sesión** (lateral del chat).
`,
  },

  // ===================================================
  // POST-VENTA
  // ===================================================
  {
    slug: 'tickets',
    icon: 'MessageCircle',
    titulo: 'Tickets de Soporte',
    categoria: 'postventa',
    resumen: 'Reclamos y consultas de clientes',
    contenido: `# Tickets

Sistema de gestión de soporte post-venta.

## Funcionalidades

- **Creación**: cliente (vía email/portal) o agente interno
- **Categorización**: técnico / comercial / facturación
- **Prioridad**: alta / media / baja
- **SLA**: tiempo máximo de respuesta y resolución
- **Asignación**: a un agente o equipo
- **Escalado**: si supera SLA → notifica al supervisor

## Conexiones

- **Cliente 360°**: tickets aparecen en el historial
- **Garantías**: chequea cobertura automáticamente
- **Taller**: si requiere reparación, se crea OT
- **Customer Risk**: tickets sin resolver suben el churn score
- **Notificaciones**: avisa al cliente cuando hay novedad

## Tip

Definí **SLA realistas**. Si tu equipo no puede responder en 2h, no lo prometas. Mejor 24h cumplidas que 2h incumplidas.
`,
  },
  {
    slug: 'garantias',
    icon: 'ShieldCheck',
    titulo: 'Garantías',
    categoria: 'postventa',
    resumen: 'Cobertura de productos vendidos',
    contenido: `# Garantías

Tracking automático de qué productos están en garantía.

## ¿Cómo funciona?

- Cada producto puede tener un **plazo de garantía** (ej: 12 meses)
- Al vender se crea automáticamente una garantía con vencimiento
- Si el cliente abre un ticket → el sistema chequea si está cubierto
- Si está → reparación/reemplazo sin costo
- Si vencida → se factura

## Conexiones

- **Comercial**: al vender se crea la garantía
- **Tickets**: al abrir un ticket se valida cobertura
- **Taller**: dispara OT sin facturar mano de obra
- **Stock**: el repuesto sale como entrega bajo garantía (no como venta)
- **Cliente 360°**: lista de garantías activas

## Tip

Para productos costosos, ofrecé **extensión de garantía paga**. Es margen casi puro y mejora el LTV del cliente.
`,
  },
  {
    slug: 'rma',
    icon: 'RotateCcw',
    titulo: 'RMA — Devoluciones',
    categoria: 'postventa',
    resumen: 'Devoluciones a proveedor o de cliente',
    contenido: `# RMA — Return Merchandise Authorization

Manejo de devoluciones en ambos sentidos.

## Tipos

- **RMA cliente → tú**: cliente devuelve producto defectuoso o equivocado
- **RMA tú → proveedor**: devolvés producto que viene fallado de fábrica

## Flujo

1. Se crea solicitud RMA con motivo
2. Si requiere autorización, pasa por **Aprobaciones**
3. Producto físico vuelve (con número de tracking)
4. **QMS** valida el defecto
5. Se procesa: reemplazo, nota de crédito, o reparación

## Conexiones

- **Comercial**: si es del cliente, afecta su historial
- **Compras**: si es al proveedor, afecta su rating
- **Stock**: ajuste por devolución
- **Finanzas**: nota de crédito si corresponde
- **QMS**: validación técnica del defecto
- **Customer Risk**: muchos RMAs suben el score de churn

## Tip

Si el mismo producto tiene muchos RMAs, hay problema de calidad sistémico. Revisalo con el proveedor o discontinualo.
`,
  },
  {
    slug: 'customer-risk',
    icon: 'ShieldAlert',
    titulo: 'Clientes en Riesgo (Churn IA)',
    categoria: 'postventa',
    resumen: 'Detección temprana de clientes que están por irse',
    contenido: `# Clientes en Riesgo

ML (**XGBoost**) + LLM (análisis de emails) para identificar clientes con alta probabilidad de churn.

## Score numérico (XGBoost)

13 features:
- Recencia última compra
- Frecuencia de compras
- Ticket promedio vs histórico
- Reclamos últimos 90 días
- RMAs
- Tickets sin resolver
- Facturas vencidas
- Garantías activas
- etc.

Output: **probabilidad de churn en 90 días (0-100%)**.

## Análisis cualitativo (LLM)

Si tenés postsale-mvp conectado, lee emails y extrae:
- Sentimiento
- Quejas recurrentes
- Señales explícitas ("evaluando alternativas")

## Niveles

- �**Crítico ≥75%**: acción urgente
- �**Alto ≥50%**: call de retención
- �**Medio ≥25%**: monitorear
- �**Bajo <25%**

## Conexiones

- Lee de **Comercial + Tickets + RMA + Garantías + Finanzas**
- Score aparece en **Cliente 360°**
- Triggers de alerta visibles en **Dashboard**

## Tip

Cuando alguien entra en crítico, **no mandes descuento**. Llamá primero. Muchas veces es problema operativo, no de precio.
`,
  },

  // ===================================================
  // SISTEMA
  // ===================================================
  {
    slug: 'aprobaciones',
    icon: 'CheckCircle2',
    titulo: 'Aprobaciones',
    categoria: 'sistema',
    resumen: 'Workflow de autorizaciones',
    contenido: `# Aprobaciones

Algunas operaciones requieren autorización antes de ejecutarse.

## Casos típicos

- Descuentos > 15%
- Órdenes de compra > monto X
- Cambios sobre órdenes despachadas
- Modificaciones a precios de catálogo
- Anulación de facturas
- Acciones GDPR (export/borrado de datos)

## Cómo funciona

1. Sistema detecta operación que requiere aprobación
2. Crea **solicitud pendiente**
3. Notifica a autorizadores
4. Aprueban (con motivo) o rechazan (con motivo)
5. Si aprueban → se ejecuta
6. Todo queda en **Auditoría**

## Conexiones

- Atraviesa **TODOS los módulos** que tienen reglas
- **Notificaciones**: avisa a los autorizadores
- **Auditoría**: cada decisión registrada

## Tip

Si todo requiere aprobación, los gerentes son cuello de botella. Si nada, perdés control. Diseñá las reglas con criterio.
`,
  },
  {
    slug: 'seriales',
    icon: 'QrCode',
    titulo: 'Seriales',
    categoria: 'sistema',
    resumen: 'Tracking por número de serie único',
    contenido: `# Seriales

Para productos donde cada unidad es **única e identificable** (electrónicos, maquinaria, vehículos).

## Funcionalidades

- Cada producto puede tener N seriales
- Tracking individual: dónde está, vendido a quién, en garantía o no
- Búsqueda rápida por serial

## Conexiones

- **Stock**: stock = cantidad de seriales activos
- **Comercial**: la venta vincula un serial específico al cliente
- **Garantías**: por serial, no por SKU
- **RMA**: el serial defectuoso vuelve identificado
- **Taller**: histórico de reparaciones por serial
- **Trazabilidad**: en qué almacén/ubicación está cada uno

## Tip

Si vendés equipos costosos, **siempre por serial**. Te permite hacer recall si hay defecto sistémico, defender garantía, y prevenir fraude.
`,
  },
  {
    slug: 'trazabilidad',
    icon: 'GitBranch',
    titulo: 'Trazabilidad (Lotes)',
    categoria: 'sistema',
    resumen: 'Tracking por lote o batch',
    contenido: `# Trazabilidad

Cuando los productos no tienen serial pero **sí lote** (alimentos, químicos, medicamentos, cosmética).

## Funcionalidades

- Cada lote tiene **fecha de fabricación + vencimiento**
- Tracking de "qué lote entró cuándo, salió cuándo, a quién"
- Alertas de vencimiento próximo
- FIFO/FEFO automático en picking

## Conexiones

- **Stock**: cada producto puede tener N lotes activos
- **Compras**: cada recepción carga un lote con sus fechas
- **WMS**: el picking prioriza lotes que vencen primero (FEFO)
- **Comercial**: la venta queda registrada con qué lote salió
- **Ensamblajes**: si producís, el lote terminado vincula lotes de materias

## Tip

Es **obligatorio por regulación** en alimentos/farma. Si vas a exportar, es crítico para recall: en un día tenés que poder decirle al regulador "este lote fue a estos 12 clientes".
`,
  },
  {
    slug: 'qms',
    icon: 'BadgeCheck',
    titulo: 'QMS — Calidad',
    categoria: 'sistema',
    resumen: 'Control de calidad, no conformidades, auditorías',
    contenido: `# QMS — Quality Management System

Sistema de gestión de calidad (ISO 9001 friendly).

## Funcionalidades

- **Inspecciones de recepción**: cada compra puede pasar control
- **No conformidades (NCR)**: cuando algo no cumple spec
- **CAPA**: Corrective and Preventive Actions
- **Auditorías internas**: checklist + hallazgos
- **Certificados**: por producto/lote (para clientes que los exigen)

## Flujo

1. Llega mercadería → muestreo según plan
2. Si no pasa → NCR con foto/evidencia
3. Producto queda en **cuarentena** (no se puede vender)
4. Se decide: reemplazo / aceptación con descuento / scrap
5. Si es problema recurrente → CAPA con acción y responsable

## Conexiones

- **Compras**: dispara inspección al recibir
- **Stock**: la cuarentena bloquea uso
- **RMA**: NCR de fábrica = devolución a proveedor
- **Trazabilidad**: lote rechazado queda marcado
- **Auditoría**: cada NCR/CAPA registrado

## Tip

Si exportás a UE o EE.UU., empezá QMS **desde el día 1**. Los compradores institucionales lo van a pedir.
`,
  },
  {
    slug: 'auditoria',
    icon: 'FileSearch',
    titulo: 'Auditoría',
    categoria: 'sistema',
    resumen: 'Log inmutable con hash chain',
    contenido: `# Auditoría

Registro inmutable de cada acción relevante del sistema.

## ¿Qué se registra?

- Quién hizo qué, cuándo, desde qué IP
- Datos antes/después del cambio
- Hash encadenado al registro anterior

## Hash chain

Cada entry incluye el **hash del anterior**. Si alguien intenta borrar o alterar un registro del medio, la cadena se rompe y se detecta inmediatamente. Es la misma idea que blockchain pero centralizada.

## Conexiones

- **TODO** lo importante del sistema se registra
- Visible solo para roles con permiso (admin/auditor)
- Exportable para auditorías externas

## Tip

Si te audita la AFIP/DGI o un cliente institucional, **acá está toda la evidencia**. Exportá el log del período y entregalo.
`,
  },
  {
    slug: 'integraciones',
    icon: 'Plug',
    titulo: 'Integraciones',
    categoria: 'sistema',
    resumen: 'API keys, webhooks, conectores externos',
    contenido: `# Integraciones

Conectá Vanguard con sistemas externos.

## Tipos

- **API Keys**: tokens para integraciones programáticas (terceros que leen/escriben datos)
- **Webhooks**: notificaciones HTTP a sistemas externos cuando pasa algo (ej: nueva venta → notifica a Slack)
- **Conectores pre-armados**: bancos, transportistas, plataformas de e-commerce
- **Importadores Excel**: para cargar datos iniciales

## Conexiones

- Cada API key tiene **scope limitado** (ej: solo lectura de stock)
- Webhooks disparan desde **cualquier módulo**
- Las llamadas externas quedan en **Auditoría**

## Tip

Para API keys: rotalas cada 6 meses. Para webhooks: configurá retries (3 intentos) y monitoreá si fallan demasiado.
`,
  },
  {
    slug: 'chat',
    icon: 'MessageSquare',
    titulo: 'Chat / Notificaciones',
    categoria: 'sistema',
    resumen: 'Mensajería interna y avisos del sistema',
    contenido: `# Chat / Notificaciones

Mensajería interna entre usuarios + avisos automáticos del sistema.

## Funcionalidades

- Chat **persona a persona** o **grupos**
- Mencionar productos/clientes/órdenes con link directo
- Notificaciones de sistema (aprobación pendiente, stock crítico, ticket nuevo)
- Filtros por tipo de evento

## Conexiones

- **Aprobaciones**: notifica a autorizadores
- **Tickets**: notifica al agente asignado
- **Stock**: alertas de stock crítico al responsable
- **Customer Risk**: alerta cuando alguien entra en crítico

## Tip

Configurá las **preferencias de notificaciones** para no recibir spam. Sino la gente las apaga y se pierden las críticas.
`,
  },
  {
    slug: 'rrhh',
    icon: 'Users',
    titulo: 'RRHH',
    categoria: 'sistema',
    resumen: 'Empleados, ausencias, evaluaciones',
    contenido: `# RRHH

Gestión de personal.

## Funcionalidades

- **Legajo** de cada empleado
- **Ausencias**: vacaciones, licencias, ausentismo
- **Evaluaciones** de desempeño
- **Capacitaciones** y certificaciones
- **Documentos** firmados (contratos, NDAs)

## Conexiones

- **Aprobaciones**: las solicitudes de vacaciones pasan por acá
- **Taller**: si un técnico está de licencia, no aparece para asignación
- **Comercial**: cada vendedor tiene cartera/comisiones
- **Auditoría**: cambios de rol/permisos quedan registrados

## Tip

Trackeá **fechas de vencimiento de certificaciones** (técnicos, choferes). El sistema te avisa antes.
`,
  },
  {
    slug: 'multi-tenant',
    icon: 'Building',
    titulo: 'Multi-empresa (Multi-tenant)',
    categoria: 'sistema',
    resumen: 'Varias empresas desde una instancia',
    contenido: `# Multi-empresa

Una sola instancia puede manejar varias empresas con datos aislados.

## Cómo funciona

- Selector arriba del sidebar para cambiar empresa activa
- Cada registro está atado a una \`organizacion_id\`
- Aislamiento enforzado en 3 niveles:
  1. **Frontend**: queries filtran por organización activa
  2. **Backend**: middleware valida el contexto
  3. **Database**: Row-Level Security (RLS) en Supabase

## Casos de uso

- Contador con varios clientes
- Holding con varias unidades de negocio
- SaaS multi-tenant ofreciendo Vanguard a PyMEs

## Conexiones

- **TODO el sistema** respeta el contexto
- Cada **Auditoría** queda en la organización donde ocurrió
- Las **API keys** son por organización (no cross)

## Tip

Antes de invitar usuarios en producción, **verificá las RLS policies en Supabase**. Sin RLS bien configurada, los datos podrían filtrarse entre empresas.
`,
  },
  {
    slug: 'monitoreo-errores',
    icon: 'AlertTriangle',
    titulo: 'Monitoreo de Errores (Sentry)',
    categoria: 'sistema',
    resumen: 'Captura automática y alertas de errores en producción',
    contenido: `# Monitoreo de Errores

Vanguard tiene integrado **Sentry** para capturar automáticamente cualquier error que ocurra en producción — sin que vos te enteres por un cliente quejándose.

## ¿Qué captura?

- **Errores no manejados** en cualquier API route
- **Errores de React** (componentes que crashean)
- **Promesas rechazadas** sin catch
- **Crashes del layout** (errores en providers raíz)

## ¿Qué incluye cada reporte?

- Stack trace completo
- URL donde ocurrió
- Usuario afectado (anonimizado: \`j***@empresa.com\`)
- Rol y organización (como tags)
- Módulo y acción en curso
- Browser/OS del cliente
- Estado de la sesión

## ¿Qué NO se envía?

Sentry se configuró con **scrubbing agresivo**:
- Headers \`Authorization\`, \`Cookie\`, \`x-totp-code\`, \`x-api-key\` se eliminan
- Query strings con \`token=\` o \`key=\` se redactan
- Email del usuario se anonimiza
- \`sendDefaultPii: false\` para que Sentry no infiera más datos

## Cómo activarlo

1. Crear proyecto en [sentry.io](https://sentry.io) (gratis hasta 5K eventos/mes)
2. Copiar el DSN
3. Setear en las variables de entorno:
   - \`NEXT_PUBLIC_SENTRY_DSN\` (para errores client-side)
   - \`SENTRY_DSN\` (mismo valor, para server-side)
4. (Opcional) Para source maps legibles:
   - \`SENTRY_ORG\`, \`SENTRY_PROJECT\`, \`SENTRY_AUTH_TOKEN\`
5. Deploy

## Cómo testearlo

Endpoint de prueba (solo admin):
\`\`\`
GET /api/_sentry-test
\`\`\`
Dispara un error de prueba que debería aparecer en el dashboard de Sentry.

## Conexiones

- **Auditoría**: complementa al log de auditoría (auditoría = qué hizo el usuario, Sentry = qué falló)
- **Notificaciones**: configurable para que Sentry mande a Slack/email
- **TODO el sistema**: cualquier error en cualquier módulo se captura

## Tip

Configurá **alertas en Sentry** para que te avisen por Slack/email cuando:
- Un nuevo tipo de error aparece (primera vez)
- Un error supera N ocurrencias por hora
- Un error afecta a más de N usuarios únicos
`,
  },
  {
    slug: 'seguridad',
    icon: 'Lock',
    titulo: 'Seguridad',
    categoria: 'sistema',
    resumen: 'Audit log, 2FA, GDPR, encriptación',
    contenido: `# Seguridad

Vanguard incorpora seguridad enterprise-grade.

## Auditoría inmutable (hash chain)

Cada acción importante genera un registro con hash encadenado. Si alguien altera un registro del medio, la cadena se rompe.

## 2FA para acciones críticas

Los admins pueden activar 2FA (Google Authenticator). Cuando un admin exporta o borra datos de **otro usuario** (GDPR), el sistema le pide código TOTP.

Activar: \`POST /api/auth/2fa/enroll\` → escanear QR → \`POST /api/auth/2fa/verify\`.

## Encriptación de PII

Datos personales (email, teléfono, nombre) se encriptan en DB con AES-256-GCM.

## GDPR / Ley 18.331 UY

- **Export**: cualquier usuario pide sus datos en JSON
- **Borrado**: solicitud que admin procesa; datos legales (facturas) se anonimizan
- Cada acción queda en **Auditoría**

## Rate limiting

Endpoints sensibles tienen límite por hora/usuario.

## Conexiones

- **Atraviesa todos los módulos**
- Permisos enforzados por **rol** (admin/gerente/vendedor/etc.)
- Logs visibles en **Auditoría**

## Tip

Activá 2FA para todos los admins **antes** de tener data sensible cargada. Es mucho más fácil ahora que después.
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
