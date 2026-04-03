import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      header: { subtitle: 'Sistema de Gestión de Inventarios', logout: 'Cerrar sesión' },
      roles: { admin: 'Admin', seller: 'Vendedor', warehouse: 'Bodeguero', operator: 'Operador' },
      nav: { main: 'Principal', dashboard: 'Dashboard', stock: 'Stock', movements: 'Movimientos', operations: 'Operaciones', purchases: 'Compras', sales: 'Ventas', warehouses: 'Almacenes', analysis: 'Análisis', analytics: 'Analytics IA', reports: 'Reportes', costs: 'Costos', config: 'Config', integrations: 'Integraciones', audit: 'Auditoría', controlTracking: 'Control & Seguimiento' },
      greetings: {
        morning: 'Buenos días',
        afternoon: 'Buenas tardes',
        evening: 'Buenas noches',
      },
      health: {
        excellent: 'Excelente',
        good: 'Bueno',
        needsAttention: 'Necesita atención',
        critical: 'Crítico',
        healthy: 'Saludable',
        warning: 'Advertencia',
      },
      dashboard: { totalValue: 'Valor Total', itemsInStock: 'Items en Stock', lowStock: 'Stock Bajo', movementsToday: 'Movimientos Hoy', smartAlerts: 'Alertas Inteligentes', registerMovement: 'Registrar Movimiento', newProduct: 'Nuevo Producto', entryOrExit: 'Entrada o salida de inventario', addToCatalog: 'Agregar al catálogo', inventoryHealth: 'Salud del Inventario', welcomeSubtitle: 'Aquí está el resumen de tu inventario' },
      stock: { title: 'Stock', search: 'Buscar productos (búsqueda inteligente)...', allCategories: 'Todas las categorías', new: 'Nuevo', import: 'Importar CSV', image: 'Imagen', code: 'Código', description: 'Descripción', category: 'Categoría', warehouse: 'Almacén', price: 'Precio', stockCol: 'Stock', actions: 'Acciones', noWarehouse: 'Sin almacén', noProducts: 'No se encontraron productos', aiActive: 'IA activa', confirmDelete: '¿Estás seguro de eliminar este producto?', editProduct: 'Editar Producto', newProduct: 'Nuevo Producto', salePrice: 'Precio de Venta', minStock: 'Stock Mínimo', selectCategory: 'Seleccionar categoría...', addProduct: 'Agregar Producto', saveChanges: 'Guardar Cambios', currentStock: 'Stock Actual (para ajuste)', productImage: 'Imagen del producto', clickToUpload: 'Click para subir o cambiar', maxSize: 'Máximo 2MB (JPG, PNG)' , selectWarehouse: 'Seleccioná un almacén para ver sus productos', products: 'productos', totalProducts: 'Total de productos', productsWithoutWarehouse: 'Productos sin almacén asignado', initialStock: 'Stock Inicial', initialQuantity: 'Cantidad Inicial', unitCost: 'Costo Unitario', initialStockHint: 'Si agregás stock inicial, se creará automáticamente un movimiento de entrada.'},
      trends: { increasing: 'Subiendo', decreasing: 'Bajando', stable: 'Estable', noData: 'Sin datos' },
      periods: { week: 'Semana', month: 'Mes', semester: 'Semestre', year: 'Año', lastWeek: 'Última semana', lastMonth: 'Último mes', lastSemester: 'Último semestre', lastYear: 'Último año' },
      alerts: { critical: 'Crítica', medium: 'Media', low: 'Baja', noAlerts: 'No hay alertas de stock', noAlertsFilter: 'No hay alertas con este filtro' },
      analytics: { title: 'Análisis Predictivo de Inventario', description: 'Predicciones basadas en patrones históricos de consumo.', noData: 'No hay suficientes datos para generar predicciones.', predictions: 'Predicciones', anomalies: 'Anomalías', associations: 'Asociaciones', modelConfidence: 'Confianza del modelo', currentStock: 'Stock Actual', daysLeft: 'Días Restantes', daysRemaining: 'días restantes', dailyConsumption: 'Consumo/Día', trend: 'Tendencia', topConsumed: 'Productos Más Consumidos', noConsumptionData: 'No hay datos de consumo en este período', clickBarDetails: 'Click en una barra para ver detalles', realConsumption: 'Consumo real', trendLine: 'Línea de tendencia', consumptionIncreasing: 'Consumo en aumento', consumptionDecreasing: 'Consumo en descenso', consumption: 'Consumo', dayAvg: 'día promedio', estimatedCurrentRate: 'Estimado al ritmo actual', recentMovements: 'Últimos Movimientos', noMovementsPeriod: 'No hay movimientos en este período' },
      ai: { active: 'IA Activa', predictions: 'Predicciones IA (Holt-Winters + XGBoost)', anomalies: 'Anomalías (Isolation Forest)', associations: 'Productos Relacionados (Apriori)', noAnomalies: 'No se detectaron anomalías', noAssociations: 'No hay suficientes datos para asociaciones', noCriticalProducts: 'No hay productos críticos', analyzedProducts: 'productos críticos de {total} analizados', analyzedMovements: 'anomalías en {total} movimientos (últimos 30 días)' },
      movements: { title: 'Historial de Movimientos', register: 'Registrar', entry: 'Entrada', exit: 'Salida', product: 'Producto', type: 'Tipo de Movimiento', quantity: 'Cantidad', purchaseCost: 'Costo de Compra (por unidad)', howMuchPaid: '¿A cuánto compraste?', notes: 'Notas (opcional)', notesPlaceholder: 'Ej: Compra proveedor X, Factura #123', user: 'Usuario', noMovements: 'No hay movimientos registrados', registerEntry: 'Registrar Entrada', registerExit: 'Registrar Salida', selectProduct: 'Seleccionar producto...' },
      purchases: { title: 'Compras', suppliers: 'Proveedores', purchaseOrders: 'Órdenes de Compra', newSupplier: 'Nuevo Proveedor', newOrder: 'Nueva Orden', supplier: 'Proveedor', contact: 'Contacto', email: 'Email', phone: 'Teléfono', address: 'Dirección', city: 'Ciudad', country: 'País', notes: 'Notas', searchSuppliers: 'Buscar proveedores...', noSuppliers: 'No hay proveedores registrados', editSupplier: 'Editar Proveedor', createSupplier: 'Crear Proveedor', deactivateSupplier: '¿Desactivar este proveedor?', orderNumber: 'N° Orden', orderDate: 'Fecha Orden', expectedDate: 'Fecha Esperada', status: 'Estado', total: 'Total', noOrders: 'No hay órdenes de compra', loadingSuppliers: 'Cargando proveedores...', loadingOrders: 'Cargando órdenes...', products: 'Productos', addProduct: '+ Agregar producto', selectSupplier: 'Seleccionar proveedor...', selectProduct: 'Seleccionar producto...', quantity: 'Cant.', unitCost: 'Costo/u', createOrder: 'Crear Orden', markAsSent: 'Marcar como Enviada', markAsReceived: 'Marcar como Recibida', received: 'recibidos', states: { draft: 'Borrador', sent: 'Enviada', partial: 'Parcial', received: 'Recibida', cancelled: 'Cancelada' } },
      sales: { title: 'Ventas', customers: 'Clientes', salesOrders: 'Órdenes de Venta', newCustomer: 'Nuevo Cliente', newOrder: 'Nueva Venta', customer: 'Cliente', type: 'Tipo', person: 'Persona', company: 'Empresa', document: 'RUT/CI', creditLimit: 'Límite de Crédito', pendingBalance: 'Saldo Pendiente', owes: 'Debe', noCustomers: 'No hay clientes registrados', searchCustomers: 'Buscar clientes...', loadingCustomers: 'Cargando clientes...', loadingOrders: 'Cargando órdenes...', editCustomer: 'Editar Cliente', createCustomer: 'Crear Cliente', deactivateCustomer: '¿Desactivar este cliente?', orderNumber: 'N° Orden', orderDate: 'Fecha Orden', deliveryDate: 'Fecha Entrega', status: 'Estado', total: 'Total', noOrders: 'No hay órdenes de venta', selectCustomer: 'Seleccionar cliente...', selectProduct: 'Seleccionar producto...', deliveryAddress: 'Dirección de Envío', paymentMethod: 'Método de Pago', paymentMethods: { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', credit: 'Crédito' }, createSale: 'Crear Venta', paid: 'Pagado', units: 'unidades', insufficientStock: 'Stock insuficiente', states: { draft: 'Borrador', confirmed: 'Confirmada', inProcess: 'En Proceso', shipped: 'Enviada', delivered: 'Entregada', cancelled: 'Cancelada' }, actions: { confirm: 'Confirmar', inProcess: 'En Proceso', markShipped: 'Marcar Enviada', markDelivered: 'Marcar Entregada' } },
      warehouses: { title: 'Almacenes', transfers: 'Transferencias', newWarehouse: 'Nuevo Almacén', newTransfer: 'Nueva Transferencia', main: 'Principal', address: 'Dirección', city: 'Ciudad', phone: 'Teléfono', manager: 'Responsable', edit: 'Editar', deactivate: '¿Desactivar este almacén?', code: 'Código', name: 'Nombre', editWarehouse: 'Editar Almacén', origin: 'Almacén Origen', destination: 'Almacén Destino', products: 'Productos', addProduct: '+ Agregar producto', createTransfer: 'Crear Transferencia', noTransfers: 'No hay transferencias', send: 'Enviar', confirmReception: 'Confirmar Recepción', selectOrigin: 'Seleccionar...', selectProduct: 'Seleccionar...', units: 'unidades', notesOptional: 'Notas opcionales...', selectOriginDestination: 'Selecciona origen, destino y al menos un producto', states: { pending: 'Pendiente', inTransit: 'En Tránsito', completed: 'Completada', cancelled: 'Cancelada' } },
      costs: { title: 'Análisis de Costos', inventoryCost: 'Costo Inventario (FIFO)', saleValue: 'Valor Venta', grossMargin: 'Margen Bruto', marginPercent: '% Margen', topProducts: 'Top 5 Productos por Valor en Stock', salePrice: 'precio venta', activeLots: 'Lotes Activos', noLots: 'No hay lotes activos', inventoryLots: 'Lotes de Inventario', noLotsRegistered: 'No hay lotes registrados', lot: 'Lote', available: 'Disponible', unitCost: 'Costo Unit.', lotValue: 'Valor Lote', totalStockValue: 'Valor Total en Stock (FIFO)', weightedAvgCost: 'Costo Promedio Ponderado', priceHistory: 'Historial de Precios', changes: 'cambios', noPriceChanges: 'No hay cambios de precio', from: 'De', to: 'A', noProductsWithCost: 'No hay productos con costo registrado' },
      reports: { title: 'Reportes', executiveDashboard: 'Dashboard Ejecutivo', kpiSummary: 'Resumen de KPIs e indicadores clave', exportPDF: 'PDF', exportExcel: 'Excel', inventoryValue: 'Valor del Inventario', itemsInStock: 'Items en Stock', products: 'productos', entriesMonth: 'Entradas del Mes', exitsMonth: 'Salidas del Mes', lowStockProducts: 'Productos Stock Bajo', requiresAttention: 'Requieren atención', outOfStock: 'Productos Sin Stock', depleted: 'Agotados', inventoryRotation: 'Rotación Inventario', avgReplacement: 'Promedio de reposición', days: 'días', topSoldProducts: 'Top 5 Productos Más Vendidos', noSalesThisMonth: 'No hay datos de ventas este mes', categoryDistribution: 'Distribución por Categoría', items: 'items' },
      integrations: { title: 'Integraciones eCommerce', subtitle: 'Conecta tu inventario con tiendas online', shopify: 'Shopify', shopifyDesc: 'Sincroniza productos y órdenes con Shopify', woocommerce: 'WooCommerce', woocommerceDesc: 'Conecta con WordPress + WooCommerce', mercadolibre: 'MercadoLibre', mercadolibreDesc: 'Sincroniza publicaciones y ventas', tiendanube: 'TiendaNube', tiendanubeDesc: 'Integración con TiendaNube', connected: 'Activo', disconnected: 'Inactivo', sync: 'Sincronizar', syncing: 'Sincronizando...', lastSync: 'Última sincronización', noIntegrations: 'Sin integraciones', noIntegrationsDesc: 'Conecta tu primera tienda online', newIntegration: 'Nueva Integración', addIntegration: 'Agregar Integración', editIntegration: 'Editar Integración', configure: 'Configurar', selectPlatform: 'Selecciona la plataforma:', storeName: 'Nombre de la tienda', storeUrl: 'URL de la tienda', apiKey: 'API Key / Client ID', apiSecret: 'API Secret / Access Token', credentialsWarning: 'Las credenciales se guardan de forma segura.', deleteConfirm: '¿Eliminar esta integración?', loading: 'Cargando integraciones...' },
      audit: { title: 'Auditoría del Sistema', description: 'Historial de todas las acciones realizadas', noLogs: 'No hay registros de auditoría', loading: 'Cargando auditoría...', records: 'registros', allTables: 'Todas las tablas', allActions: 'Todas las acciones', in: 'en', system: 'Sistema', previousData: 'Datos anteriores', newData: 'Datos nuevos', tables: { products: 'Productos', movements: 'Movimientos' }, actions: { create: 'Crear', update: 'Actualizar', delete: 'Eliminar' } },
      common: { save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', create: 'Crear', add: 'Agregar', close: 'Cerrar', confirm: 'Confirmar', loading: 'Cargando...', search: 'Buscar', filter: 'Filtrar', export: 'Exportar', import: 'Importar', yes: 'Sí', no: 'No', active: 'Activo', inactive: 'Inactivo', status: 'Estado', date: 'Fecha', total: 'Total', subtotal: 'Subtotal', discount: 'Descuento', taxes: 'Impuestos', noPermission: 'Sin permisos', actions: 'Acciones', select: 'Seleccionar...', suggestion: 'Sugerencia', confidence: 'confianza', apply: 'Aplicar', all: 'Todas', noCategory: 'Sin categoría', perUnit: 'Por unidad', retry: 'Reintentar', noData: 'No hay datos', view: 'Ver', optional: 'opcional'},
      settings: { title: 'Configuración', language: 'Idioma', currency: 'Moneda', theme: 'Tema', themes: { dark: 'Oscuro', light: 'Claro', system: 'Sistema' } },
      currencies: { USD: 'Dólar estadounidense', EUR: 'Euro', UYU: 'Peso uruguayo', ARS: 'Peso argentino', BRL: 'Real brasileño' },
      errors: {
        loadingError: 'Error al cargar',
        tryAgain: 'Intentá de nuevo',
        timeout: 'Tiempo de espera agotado',
        slowConnection: 'La conexión está lenta. Verificá tu internet.',
        offline: 'Sin conexión',
        checkConnection: 'Verificá tu conexión a internet',
        serverError: 'Error del servidor',
        unknownError: 'Error desconocido',
      },
      // Module navigation labels
      modules: {
        messages: 'Mensajes', comercial: 'Comercial', finance: 'Finanzas', projects: 'Proyectos',
        workshop: 'Taller', wms: 'WMS', costs: 'Costos', demandPlanning: 'Demand Planning',
        quality: 'Calidad (QMS)', serials: 'Seriales', traceability: 'Trazabilidad',
        returns: 'Devoluciones', bom: 'BOM', assemblies: 'Ensamblajes',
        inventory: 'Inventario', operations: 'Operaciones', analysis: 'Análisis',
        control: 'Control', config: 'Configuración', home: 'Inicio', chat: 'Chat',
      },
      // Theme
      theme: { lightMode: 'Modo Claro', darkMode: 'Modo Oscuro' },
      // Notifications
      notifications: {
        title: 'Notificaciones', noStock: 'Sin stock', lowStock: 'Stock bajo', depleted: 'Agotado',
        markAllRead: 'Marcar todo leído', noNotifications: 'Sin notificaciones', markAll: 'Marcar todas',
        loading: 'Cargando...', noNotificationsProject: 'No hay notificaciones', viewAll: 'Ver todas las notificaciones',
        now: 'Ahora', markRead: 'Marcar como leída', deleteNotif: 'Eliminar',
      },
      // Shortcuts
      shortcuts: {
        title: 'Atajos de Teclado', globalSearch: 'Búsqueda global', scanBarcode: 'Escanear código de barras',
        newProduct: 'Nuevo producto', newMovement: 'Nuevo movimiento', closeModal: 'Cerrar modal',
        pressEscToClose: 'Presiona Esc para cerrar',
      },
      // Onboarding
      onboarding: {
        welcome: 'Bienvenido a Vanguard',
        welcomeDesc: 'Tu sistema integral de gestión de inventarios. Te guiaremos por las funciones principales.',
        sideNav: 'Navegación lateral',
        sideNavDesc: 'Usa la barra lateral para acceder a todos los módulos: Stock, Ventas, Compras, Reportes y más.',
        quickSearch: 'Búsqueda rápida',
        quickSearchDesc: 'Presiona Ctrl+K en cualquier momento para buscar productos, módulos o acciones rápidamente.',
        aiChatbot: 'Chatbot con IA',
        aiChatbotDesc: 'Usa el asistente de IA en la esquina inferior derecha para obtener ayuda, consultar datos o ejecutar acciones.',
        skip: 'Saltar', skipTour: 'Saltar tour', start: 'Comenzar', next: 'Siguiente',
      },
      // Taller
      taller: {
        title: 'Taller', reception: 'Recepción', diagnosis: 'Diagnóstico', quote: 'Cotización',
        approved: 'Aprobado', rejected: 'Rechazado', inRepair: 'En Reparación', repaired: 'Reparado',
        invoiced: 'Facturado', readyDelivery: 'Listo Entrega', delivered: 'Entregado', cancelled: 'Cancelado',
        newOrder: 'Nueva Orden', orders: 'Órdenes', history: 'Historial', stock: 'Repuestos',
        stats: 'Estadísticas', client: 'Cliente', device: 'Equipo', brand: 'Marca', model: 'Modelo',
        serial: 'Serial', warranty: 'Garantía', accessories: 'Accesorios', problem: 'Problema Reportado',
        assignTech: 'Asignar Técnico', save: 'Guardar', createOrder: 'Crear Orden',
        sendQuote: 'Enviar Cotización', startRepair: 'Iniciar Reparación', finishRepair: 'Finalizar Reparación',
        generateInvoice: 'Generar Factura', readyForDelivery: 'Listo para Entrega', markDelivered: 'Marcar Entregado',
        cancel: 'Cancelar Orden', addNote: 'Agregar Nota', addPart: 'Agregar Repuesto',
        noOrders: 'No hay órdenes', searchOrders: 'Buscar órdenes...', orderDetail: 'Detalle de Orden',
        notifyClient: 'Notificar Cliente', timeline: 'Línea de tiempo', notes: 'Notas',
        parts: 'Repuestos utilizados', subtotal: 'Subtotal', discount: 'Descuento', tax: 'IVA',
        total: 'Total', processing: 'Procesando...', noTechnician: 'Sin técnico asignado',
        loading: 'Cargando...',
      },
      // Proyectos
      proyectos: {
        title: 'Proyectos', newProject: 'Nuevo Proyecto', tasks: 'Tareas', kanban: 'Kanban',
        list: 'Lista', calendar: 'Calendario', activity: 'Actividad', time: 'Tiempo',
        members: 'Miembros', settings: 'Configuración', priority: 'Prioridad',
        high: 'Alta', medium: 'Media', low: 'Baja', urgent: 'Urgente',
        dueDate: 'Fecha límite', assignedTo: 'Asignado a', status: 'Estado',
        inProgress: 'En progreso', completed: 'Completado', pending: 'Pendiente',
        noProjects: 'No hay proyectos', noTasks: 'No hay tareas', addTask: 'Agregar Tarea',
        addColumn: 'Agregar Columna', moveTask: 'Mover Tarea', duplicateTask: 'Duplicar Tarea',
        deleteTask: 'Eliminar Tarea', editTask: 'Editar Tarea', comments: 'Comentarios',
        attachments: 'Adjuntos', timeTracked: 'Tiempo Registrado', description: 'Descripción',
      },
      // Chat
      chat: {
        title: 'Mensajes', search: 'Buscar conversación...', newConversation: 'Nueva Conversación',
        typeMessage: 'Escribe un mensaje...', noConversations: 'No hay conversaciones',
        participants: 'Participantes', selectConversation: 'Seleccioná una conversación',
        send: 'Enviar', online: 'En línea', offline: 'Desconectado',
      },
      // QMS
      qms: {
        title: 'Calidad (QMS)', dashboard: 'Dashboard', incomingInspection: 'Inspección Recepción',
        processControl: 'Control en Proceso', nonConformities: 'No Conformidades', capas: 'CAPAs',
        certificates: 'Certificados', recalls: 'Recalls', audits: 'Auditorías',
        approved: 'Aprobado', rejected: 'Rechazado', pending: 'Pendiente',
        inspector: 'Inspector', result: 'Resultado', observations: 'Observaciones',
      },
      // Finanzas
      finanzas: {
        title: 'Finanzas', accounts: 'Cuentas', transactions: 'Transacciones',
        accountsReceivable: 'Cuentas por Cobrar', accountsPayable: 'Cuentas por Pagar',
        cashFlow: 'Flujo de Caja', balance: 'Balance', income: 'Ingresos', expenses: 'Gastos',
        bankAccount: 'Cuenta Bancaria', cash: 'Efectivo', credit: 'Crédito',
        currency: 'Moneda', amount: 'Monto', date: 'Fecha', concept: 'Concepto',
      },
      // WMS
      wmsModule: {
        title: 'WMS', dashboard: 'Dashboard', locations: 'Ubicaciones', receiving: 'Recepción',
        picking: 'Picking', inventory: 'Inventario', movements: 'Movimientos',
        slotting: 'Slotting', config: 'Configuración', zone: 'Zona', aisle: 'Pasillo',
        rack: 'Rack', level: 'Nivel', position: 'Posición',
      },
      // Demand Planning
      demandModule: {
        title: 'Demand Planning', dashboard: 'Dashboard', forecast: 'Forecast',
        alerts: 'Alertas', replenishment: 'Reposición', trends: 'Tendencias',
        config: 'Configuración', safetyStock: 'Stock de Seguridad', reorderPoint: 'Punto de Reorden',
        leadTime: 'Tiempo de Entrega',
      },
      // RMA
      rma: {
        title: 'Devoluciones (RMA)', requested: 'Solicitada', approved: 'Aprobada',
        rejected: 'Rechazada', received: 'Recibida', processing: 'En proceso',
        resolved: 'Resuelta', reason: 'Motivo', resolution: 'Resolución',
      },
      // BOM & Ensamblajes
      bom: {
        title: 'Lista de Materiales (BOM)', components: 'Componentes', quantity: 'Cantidad',
        level: 'Nivel', parent: 'Padre', child: 'Hijo',
      },
      assemblies: {
        title: 'Ensamblajes', newAssembly: 'Nuevo Ensamblaje', status: 'Estado',
        inProgress: 'En Progreso', completed: 'Completado', pending: 'Pendiente',
      },
      // Seriales & Trazabilidad
      seriales: {
        title: 'Seriales', serialNumber: 'Número de Serie', status: 'Estado',
        active: 'Activo', inactive: 'Inactivo',
      },
      traceability: {
        title: 'Trazabilidad', lot: 'Lote', origin: 'Origen', destination: 'Destino',
        chain: 'Cadena de Custodia',
      },
    },
  },
  en: {
    translation: {
      header: { subtitle: 'Inventory Management System', logout: 'Log out' },
      roles: { admin: 'Admin', seller: 'Seller', warehouse: 'Warehouse', operator: 'Operator' },
      nav: { main: 'Main', dashboard: 'Dashboard', stock: 'Stock', movements: 'Movements', operations: 'Operations', purchases: 'Purchases', sales: 'Sales', warehouses: 'Warehouses', analysis: 'Analysis', analytics: 'AI Analytics', reports: 'Reports', costs: 'Costs', config: 'Config', integrations: 'Integrations', audit: 'Audit', controlTracking: 'Control & Tracking' },
      greetings: {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
      },
      health: {
        excellent: 'Excellent',
        good: 'Good',
        needsAttention: 'Needs attention',
        critical: 'Critical',
        healthy: 'Healthy',
        warning: 'Warning',
      },
      dashboard: { totalValue: 'Total Value', itemsInStock: 'Items in Stock', lowStock: 'Low Stock', movementsToday: 'Movements Today', smartAlerts: 'Smart Alerts', registerMovement: 'Register Movement', newProduct: 'New Product', entryOrExit: 'Inventory entry or exit', addToCatalog: 'Add to catalog', inventoryHealth: 'Inventory Health', welcomeSubtitle: 'Here is your inventory summary' },
      stock: { title: 'Stock', search: 'Search products (smart search)...', allCategories: 'All categories', new: 'New', import: 'Import CSV', image: 'Image', code: 'Code', description: 'Description', category: 'Category', warehouse: 'Warehouse', price: 'Price', stockCol: 'Stock', actions: 'Actions', noWarehouse: 'No warehouse', noProducts: 'No products found', aiActive: 'AI active', confirmDelete: 'Are you sure you want to delete this product?', editProduct: 'Edit Product', newProduct: 'New Product', salePrice: 'Sale Price', minStock: 'Minimum Stock', selectCategory: 'Select category...', addProduct: 'Add Product', saveChanges: 'Save Changes', currentStock: 'Current Stock (for adjustment)', productImage: 'Product image', clickToUpload: 'Click to upload or change', maxSize: 'Maximum 2MB (JPG, PNG)', selectWarehouse: 'Select a warehouse to view its products', products: 'products', totalProducts: 'Total products', productsWithoutWarehouse: 'Products without assigned warehouse', initialStock: 'Initial Stock', initialQuantity: 'Initial Quantity', unitCost: 'Unit Cost', initialStockHint: 'If you add initial stock, an entry movement will be created automatically.' },
      trends: { increasing: 'Increasing', decreasing: 'Decreasing', stable: 'Stable', noData: 'No data' },
      periods: { week: 'Week', month: 'Month', semester: 'Semester', year: 'Year', lastWeek: 'Last week', lastMonth: 'Last month', lastSemester: 'Last semester', lastYear: 'Last year' },
      alerts: { critical: 'Critical', medium: 'Medium', low: 'Low', noAlerts: 'No stock alerts', noAlertsFilter: 'No alerts with this filter' },
      analytics: { title: 'Predictive Inventory Analysis', description: 'Predictions based on historical consumption patterns.', noData: 'Not enough data to generate predictions.', predictions: 'Predictions', anomalies: 'Anomalies', associations: 'Associations', modelConfidence: 'Model confidence', currentStock: 'Current Stock', daysLeft: 'Days Left', daysRemaining: 'days remaining', dailyConsumption: 'Daily Consumption', trend: 'Trend', topConsumed: 'Top Consumed Products', noConsumptionData: 'No consumption data in this period', clickBarDetails: 'Click on a bar to see details', realConsumption: 'Real consumption', trendLine: 'Trend line', consumptionIncreasing: 'Consumption increasing', consumptionDecreasing: 'Consumption decreasing', consumption: 'Consumption', dayAvg: 'day average', estimatedCurrentRate: 'Estimated at current rate', recentMovements: 'Recent Movements', noMovementsPeriod: 'No movements in this period' },
      ai: { active: 'AI Active', predictions: 'AI Predictions (Holt-Winters + XGBoost)', anomalies: 'Anomalies (Isolation Forest)', associations: 'Related Products (Apriori)', noAnomalies: 'No anomalies detected', noAssociations: 'Not enough data for associations', noCriticalProducts: 'No critical products', analyzedProducts: 'critical products of {total} analyzed', analyzedMovements: 'anomalies in {total} movements (last 30 days)' },
      movements: { title: 'Movement History', register: 'Register', entry: 'Entry', exit: 'Exit', product: 'Product', type: 'Movement Type', quantity: 'Quantity', purchaseCost: 'Purchase Cost (per unit)', howMuchPaid: 'How much did you pay?', notes: 'Notes (optional)', notesPlaceholder: 'Ex: Supplier X purchase, Invoice #123', user: 'User', noMovements: 'No movements registered', registerEntry: 'Register Entry', registerExit: 'Register Exit', selectProduct: 'Select product...' },
      purchases: { title: 'Purchases', suppliers: 'Suppliers', purchaseOrders: 'Purchase Orders', newSupplier: 'New Supplier', newOrder: 'New Order', supplier: 'Supplier', contact: 'Contact', email: 'Email', phone: 'Phone', address: 'Address', city: 'City', country: 'Country', notes: 'Notes', searchSuppliers: 'Search suppliers...', noSuppliers: 'No suppliers registered', editSupplier: 'Edit Supplier', createSupplier: 'Create Supplier', deactivateSupplier: 'Deactivate this supplier?', orderNumber: 'Order #', orderDate: 'Order Date', expectedDate: 'Expected Date', status: 'Status', total: 'Total', noOrders: 'No purchase orders', loadingSuppliers: 'Loading suppliers...', loadingOrders: 'Loading orders...', products: 'Products', addProduct: '+ Add product', selectSupplier: 'Select supplier...', selectProduct: 'Select product...', quantity: 'Qty', unitCost: 'Cost/u', createOrder: 'Create Order', markAsSent: 'Mark as Sent', markAsReceived: 'Mark as Received', received: 'received', states: { draft: 'Draft', sent: 'Sent', partial: 'Partial', received: 'Received', cancelled: 'Cancelled' } },
      sales: { title: 'Sales', customers: 'Customers', salesOrders: 'Sales Orders', newCustomer: 'New Customer', newOrder: 'New Sale', customer: 'Customer', type: 'Type', person: 'Person', company: 'Company', document: 'Tax ID', creditLimit: 'Credit Limit', pendingBalance: 'Pending Balance', owes: 'Owes', noCustomers: 'No customers registered', searchCustomers: 'Search customers...', loadingCustomers: 'Loading customers...', loadingOrders: 'Loading orders...', editCustomer: 'Edit Customer', createCustomer: 'Create Customer', deactivateCustomer: 'Deactivate this customer?', orderNumber: 'Order #', orderDate: 'Order Date', deliveryDate: 'Delivery Date', status: 'Status', total: 'Total', noOrders: 'No sales orders', selectCustomer: 'Select customer...', selectProduct: 'Select product...', deliveryAddress: 'Delivery Address', paymentMethod: 'Payment Method', paymentMethods: { cash: 'Cash', transfer: 'Transfer', card: 'Card', credit: 'Credit' }, createSale: 'Create Sale', paid: 'Paid', units: 'units', insufficientStock: 'Insufficient stock', states: { draft: 'Draft', confirmed: 'Confirmed', inProcess: 'In Process', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }, actions: { confirm: 'Confirm', inProcess: 'In Process', markShipped: 'Mark Shipped', markDelivered: 'Mark Delivered' } },
      warehouses: { title: 'Warehouses', transfers: 'Transfers', newWarehouse: 'New Warehouse', newTransfer: 'New Transfer', main: 'Main', address: 'Address', city: 'City', phone: 'Phone', manager: 'Manager', edit: 'Edit', deactivate: 'Deactivate this warehouse?', code: 'Code', name: 'Name', editWarehouse: 'Edit Warehouse', origin: 'Origin Warehouse', destination: 'Destination Warehouse', products: 'Products', addProduct: '+ Add product', createTransfer: 'Create Transfer', noTransfers: 'No transfers', send: 'Send', confirmReception: 'Confirm Reception', selectOrigin: 'Select...', selectProduct: 'Select...', units: 'units', notesOptional: 'Optional notes...', selectOriginDestination: 'Select origin, destination and at least one product', states: { pending: 'Pending', inTransit: 'In Transit', completed: 'Completed', cancelled: 'Cancelled' } },
      costs: { title: 'Cost Analysis', inventoryCost: 'Inventory Cost (FIFO)', saleValue: 'Sale Value', grossMargin: 'Gross Margin', marginPercent: 'Margin %', topProducts: 'Top 5 Products by Stock Value', salePrice: 'sale price', activeLots: 'Active Lots', noLots: 'No active lots', inventoryLots: 'Inventory Lots', noLotsRegistered: 'No lots registered', lot: 'Lot', available: 'Available', unitCost: 'Unit Cost', lotValue: 'Lot Value', totalStockValue: 'Total Stock Value (FIFO)', weightedAvgCost: 'Weighted Average Cost', priceHistory: 'Price History', changes: 'changes', noPriceChanges: 'No price changes', from: 'From', to: 'To', noProductsWithCost: 'No products with registered cost' },
      reports: { title: 'Reports', executiveDashboard: 'Executive Dashboard', kpiSummary: 'KPIs and key indicators summary', exportPDF: 'PDF', exportExcel: 'Excel', inventoryValue: 'Inventory Value', itemsInStock: 'Items in Stock', products: 'products', entriesMonth: 'Entries This Month', exitsMonth: 'Exits This Month', lowStockProducts: 'Low Stock Products', requiresAttention: 'Require attention', outOfStock: 'Out of Stock', depleted: 'Depleted', inventoryRotation: 'Inventory Rotation', avgReplacement: 'Average replacement', days: 'days', topSoldProducts: 'Top 5 Best Selling Products', noSalesThisMonth: 'No sales data this month', categoryDistribution: 'Category Distribution', items: 'items' },
      integrations: { title: 'eCommerce Integrations', subtitle: 'Connect your inventory with online stores', shopify: 'Shopify', shopifyDesc: 'Sync products and orders with Shopify', woocommerce: 'WooCommerce', woocommerceDesc: 'Connect with WordPress + WooCommerce', mercadolibre: 'MercadoLibre', mercadolibreDesc: 'Sync listings and sales', tiendanube: 'TiendaNube', tiendanubeDesc: 'TiendaNube integration', connected: 'Active', disconnected: 'Inactive', sync: 'Sync', syncing: 'Syncing...', lastSync: 'Last sync', noIntegrations: 'No integrations', noIntegrationsDesc: 'Connect your first online store', newIntegration: 'New Integration', addIntegration: 'Add Integration', editIntegration: 'Edit Integration', configure: 'Configure', selectPlatform: 'Select platform:', storeName: 'Store name', storeUrl: 'Store URL', apiKey: 'API Key / Client ID', apiSecret: 'API Secret / Access Token', credentialsWarning: 'Credentials are stored securely.', deleteConfirm: 'Delete this integration?', loading: 'Loading integrations...' },
      audit: { title: 'System Audit', description: 'History of all actions performed', noLogs: 'No audit logs', loading: 'Loading audit...', records: 'records', allTables: 'All tables', allActions: 'All actions', in: 'in', system: 'System', previousData: 'Previous data', newData: 'New data', tables: { products: 'Products', movements: 'Movements' }, actions: { create: 'Create', update: 'Update', delete: 'Delete' } },
      common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', create: 'Create', add: 'Add', close: 'Close', confirm: 'Confirm', loading: 'Loading...', search: 'Search', filter: 'Filter', export: 'Export', import: 'Import', yes: 'Yes', no: 'No', active: 'Active', inactive: 'Inactive', status: 'Status', date: 'Date', total: 'Total', subtotal: 'Subtotal', discount: 'Discount', taxes: 'Taxes', noPermission: 'No permission', actions: 'Actions', select: 'Select...', suggestion: 'Suggestion', confidence: 'confidence', apply: 'Apply', all: 'All', noCategory: 'No category', perUnit: 'Per unit', retry: 'Retry', noData: 'No data', view: 'View', optional: 'optional' },
      settings: { title: 'Settings', language: 'Language', currency: 'Currency', theme: 'Theme', themes: { dark: 'Dark', light: 'Light', system: 'System' } },
      currencies: { USD: 'US Dollar', EUR: 'Euro', UYU: 'Uruguayan Peso', ARS: 'Argentine Peso', BRL: 'Brazilian Real' },
      errors: {
        loadingError: 'Loading error',
        tryAgain: 'Please try again',
        timeout: 'Request timed out',
        slowConnection: 'Connection is slow. Check your internet.',
        offline: 'No connection',
        checkConnection: 'Check your internet connection',
        serverError: 'Server error',
        unknownError: 'Unknown error',
      },
      modules: {
        messages: 'Messages', comercial: 'Commercial', finance: 'Finance', projects: 'Projects',
        workshop: 'Workshop', wms: 'WMS', costs: 'Costs', demandPlanning: 'Demand Planning',
        quality: 'Quality (QMS)', serials: 'Serials', traceability: 'Traceability',
        returns: 'Returns', bom: 'BOM', assemblies: 'Assemblies',
        inventory: 'Inventory', operations: 'Operations', analysis: 'Analysis',
        control: 'Control', config: 'Settings', home: 'Home', chat: 'Chat',
      },
      theme: { lightMode: 'Light Mode', darkMode: 'Dark Mode' },
      notifications: {
        title: 'Notifications', noStock: 'Out of stock', lowStock: 'Low stock', depleted: 'Depleted',
        markAllRead: 'Mark all read', noNotifications: 'No notifications', markAll: 'Mark all',
        loading: 'Loading...', noNotificationsProject: 'No notifications', viewAll: 'View all notifications',
        now: 'Now', markRead: 'Mark as read', deleteNotif: 'Delete',
      },
      shortcuts: {
        title: 'Keyboard Shortcuts', globalSearch: 'Global search', scanBarcode: 'Scan barcode',
        newProduct: 'New product', newMovement: 'New movement', closeModal: 'Close modal',
        pressEscToClose: 'Press Esc to close',
      },
      onboarding: {
        welcome: 'Welcome to Vanguard',
        welcomeDesc: 'Your comprehensive inventory management system. We\'ll guide you through the main features.',
        sideNav: 'Side Navigation',
        sideNavDesc: 'Use the sidebar to access all modules: Stock, Sales, Purchases, Reports and more.',
        quickSearch: 'Quick Search',
        quickSearchDesc: 'Press Ctrl+K anytime to quickly search products, modules or actions.',
        aiChatbot: 'AI Chatbot',
        aiChatbotDesc: 'Use the AI assistant in the bottom right corner to get help, query data or execute actions.',
        skip: 'Skip', skipTour: 'Skip tour', start: 'Start', next: 'Next',
      },
      taller: {
        title: 'Workshop', reception: 'Reception', diagnosis: 'Diagnosis', quote: 'Quote',
        approved: 'Approved', rejected: 'Rejected', inRepair: 'In Repair', repaired: 'Repaired',
        invoiced: 'Invoiced', readyDelivery: 'Ready for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
        newOrder: 'New Order', orders: 'Orders', history: 'History', stock: 'Parts',
        stats: 'Statistics', client: 'Client', device: 'Device', brand: 'Brand', model: 'Model',
        serial: 'Serial', warranty: 'Warranty', accessories: 'Accessories', problem: 'Reported Problem',
        assignTech: 'Assign Technician', save: 'Save', createOrder: 'Create Order',
        sendQuote: 'Send Quote', startRepair: 'Start Repair', finishRepair: 'Finish Repair',
        generateInvoice: 'Generate Invoice', readyForDelivery: 'Ready for Delivery', markDelivered: 'Mark Delivered',
        cancel: 'Cancel Order', addNote: 'Add Note', addPart: 'Add Part',
        noOrders: 'No orders', searchOrders: 'Search orders...', orderDetail: 'Order Detail',
        notifyClient: 'Notify Client', timeline: 'Timeline', notes: 'Notes',
        parts: 'Parts used', subtotal: 'Subtotal', discount: 'Discount', tax: 'Tax',
        total: 'Total', processing: 'Processing...', noTechnician: 'No technician assigned',
        loading: 'Loading...',
      },
      proyectos: {
        title: 'Projects', newProject: 'New Project', tasks: 'Tasks', kanban: 'Kanban',
        list: 'List', calendar: 'Calendar', activity: 'Activity', time: 'Time',
        members: 'Members', settings: 'Settings', priority: 'Priority',
        high: 'High', medium: 'Medium', low: 'Low', urgent: 'Urgent',
        dueDate: 'Due date', assignedTo: 'Assigned to', status: 'Status',
        inProgress: 'In progress', completed: 'Completed', pending: 'Pending',
        noProjects: 'No projects', noTasks: 'No tasks', addTask: 'Add Task',
        addColumn: 'Add Column', moveTask: 'Move Task', duplicateTask: 'Duplicate Task',
        deleteTask: 'Delete Task', editTask: 'Edit Task', comments: 'Comments',
        attachments: 'Attachments', timeTracked: 'Time Tracked', description: 'Description',
      },
      chat: {
        title: 'Messages', search: 'Search conversations...', newConversation: 'New Conversation',
        typeMessage: 'Type a message...', noConversations: 'No conversations',
        participants: 'Participants', selectConversation: 'Select a conversation',
        send: 'Send', online: 'Online', offline: 'Offline',
      },
      qms: {
        title: 'Quality (QMS)', dashboard: 'Dashboard', incomingInspection: 'Incoming Inspection',
        processControl: 'Process Control', nonConformities: 'Non-Conformities', capas: 'CAPAs',
        certificates: 'Certificates', recalls: 'Recalls', audits: 'Audits',
        approved: 'Approved', rejected: 'Rejected', pending: 'Pending',
        inspector: 'Inspector', result: 'Result', observations: 'Observations',
      },
      finanzas: {
        title: 'Finance', accounts: 'Accounts', transactions: 'Transactions',
        accountsReceivable: 'Accounts Receivable', accountsPayable: 'Accounts Payable',
        cashFlow: 'Cash Flow', balance: 'Balance', income: 'Income', expenses: 'Expenses',
        bankAccount: 'Bank Account', cash: 'Cash', credit: 'Credit',
        currency: 'Currency', amount: 'Amount', date: 'Date', concept: 'Concept',
      },
      wmsModule: {
        title: 'WMS', dashboard: 'Dashboard', locations: 'Locations', receiving: 'Receiving',
        picking: 'Picking', inventory: 'Inventory', movements: 'Movements',
        slotting: 'Slotting', config: 'Settings', zone: 'Zone', aisle: 'Aisle',
        rack: 'Rack', level: 'Level', position: 'Position',
      },
      demandModule: {
        title: 'Demand Planning', dashboard: 'Dashboard', forecast: 'Forecast',
        alerts: 'Alerts', replenishment: 'Replenishment', trends: 'Trends',
        config: 'Settings', safetyStock: 'Safety Stock', reorderPoint: 'Reorder Point',
        leadTime: 'Lead Time',
      },
      rma: {
        title: 'Returns (RMA)', requested: 'Requested', approved: 'Approved',
        rejected: 'Rejected', received: 'Received', processing: 'Processing',
        resolved: 'Resolved', reason: 'Reason', resolution: 'Resolution',
      },
      bom: {
        title: 'Bill of Materials (BOM)', components: 'Components', quantity: 'Quantity',
        level: 'Level', parent: 'Parent', child: 'Child',
      },
      assemblies: {
        title: 'Assemblies', newAssembly: 'New Assembly', status: 'Status',
        inProgress: 'In Progress', completed: 'Completed', pending: 'Pending',
      },
      seriales: {
        title: 'Serials', serialNumber: 'Serial Number', status: 'Status',
        active: 'Active', inactive: 'Inactive',
      },
      traceability: {
        title: 'Traceability', lot: 'Lot', origin: 'Origin', destination: 'Destination',
        chain: 'Chain of Custody',
      },
    },
  },
  pt: {
    translation: {
      header: { subtitle: 'Sistema de Gestão de Inventário', logout: 'Sair' },
      roles: { admin: 'Admin', seller: 'Vendedor', warehouse: 'Armazém', operator: 'Operador' },
      nav: { main: 'Principal', dashboard: 'Painel', stock: 'Estoque', movements: 'Movimentos', operations: 'Operações', purchases: 'Compras', sales: 'Vendas', warehouses: 'Armazéns', analysis: 'Análise', analytics: 'Analytics IA', reports: 'Relatórios', costs: 'Custos', config: 'Config', integrations: 'Integrações', audit: 'Auditoria', controlTracking: 'Controle & Rastreamento' },
      greetings: {
        morning: 'Bom dia',
        afternoon: 'Boa tarde',
        evening: 'Boa noite',
      },
      health: {
        excellent: 'Excelente',
        good: 'Bom',
        needsAttention: 'Precisa de atenção',
        critical: 'Crítico',
        healthy: 'Saudável',
        warning: 'Aviso',
      },
      dashboard: { totalValue: 'Valor Total', itemsInStock: 'Itens em Estoque', lowStock: 'Estoque Baixo', movementsToday: 'Movimentos Hoje', smartAlerts: 'Alertas Inteligentes', registerMovement: 'Registrar Movimento', newProduct: 'Novo Produto', entryOrExit: 'Entrada ou saída de estoque', addToCatalog: 'Adicionar ao catálogo', inventoryHealth: 'Saúde do Inventário', welcomeSubtitle: 'Aqui está o resumo do seu inventário' },
      stock: { title: 'Estoque', search: 'Buscar produtos (busca inteligente)...', allCategories: 'Todas as categorias', new: 'Novo', import: 'Importar CSV', image: 'Imagem', code: 'Código', description: 'Descrição', category: 'Categoria', warehouse: 'Armazém', price: 'Preço', stockCol: 'Estoque', actions: 'Ações', noWarehouse: 'Sem armazém', noProducts: 'Nenhum produto encontrado', aiActive: 'IA ativa', confirmDelete: 'Tem certeza que deseja excluir este produto?', editProduct: 'Editar Produto', newProduct: 'Novo Produto', salePrice: 'Preço de Venda', minStock: 'Estoque Mínimo', selectCategory: 'Selecionar categoria...', addProduct: 'Adicionar Produto', saveChanges: 'Salvar Alterações', currentStock: 'Estoque Atual (para ajuste)', productImage: 'Imagem do produto', clickToUpload: 'Clique para enviar ou alterar', maxSize: 'Máximo 2MB (JPG, PNG)', selectWarehouse: 'Selecione um armazém para ver seus produtos', products: 'produtos', totalProducts: 'Total de produtos', productsWithoutWarehouse: 'Produtos sem armazém atribuído', initialStock: 'Estoque Inicial', initialQuantity: 'Quantidade Inicial', unitCost: 'Custo Unitário', initialStockHint: 'Se você adicionar estoque inicial, um movimento de entrada será criado automaticamente.' },
      trends: { increasing: 'Aumentando', decreasing: 'Diminuindo', stable: 'Estável', noData: 'Sem dados' },
      periods: { week: 'Semana', month: 'Mês', semester: 'Semestre', year: 'Ano', lastWeek: 'Última semana', lastMonth: 'Último mês', lastSemester: 'Último semestre', lastYear: 'Último ano' },
      alerts: { critical: 'Crítica', medium: 'Média', low: 'Baixa', noAlerts: 'Sem alertas de estoque', noAlertsFilter: 'Sem alertas com este filtro' },
      analytics: { title: 'Análise Preditiva de Inventário', description: 'Previsões baseadas em padrões históricos de consumo.', noData: 'Dados insuficientes para gerar previsões.', predictions: 'Previsões', anomalies: 'Anomalias', associations: 'Associações', modelConfidence: 'Confiança do modelo', currentStock: 'Estoque Atual', daysLeft: 'Dias Restantes', daysRemaining: 'dias restantes', dailyConsumption: 'Consumo/Dia', trend: 'Tendência', topConsumed: 'Produtos Mais Consumidos', noConsumptionData: 'Sem dados de consumo neste período', clickBarDetails: 'Clique em uma barra para ver detalhes', realConsumption: 'Consumo real', trendLine: 'Linha de tendência', consumptionIncreasing: 'Consumo aumentando', consumptionDecreasing: 'Consumo diminuindo', consumption: 'Consumo', dayAvg: 'média diária', estimatedCurrentRate: 'Estimado no ritmo atual', recentMovements: 'Movimentos Recentes', noMovementsPeriod: 'Sem movimentos neste período' },
      ai: { active: 'IA Ativa', predictions: 'Previsões IA (Holt-Winters + XGBoost)', anomalies: 'Anomalias (Isolation Forest)', associations: 'Produtos Relacionados (Apriori)', noAnomalies: 'Nenhuma anomalia detectada', noAssociations: 'Dados insuficientes para associações', noCriticalProducts: 'Sem produtos críticos', analyzedProducts: 'produtos críticos de {total} analisados', analyzedMovements: 'anomalias em {total} movimentos (últimos 30 dias)' },
      movements: { title: 'Histórico de Movimentos', register: 'Registrar', entry: 'Entrada', exit: 'Saída', product: 'Produto', type: 'Tipo de Movimento', quantity: 'Quantidade', purchaseCost: 'Custo de Compra (por unidade)', howMuchPaid: 'Quanto você pagou?', notes: 'Notas (opcional)', notesPlaceholder: 'Ex: Compra fornecedor X, Fatura #123', user: 'Usuário', noMovements: 'Nenhum movimento registrado', registerEntry: 'Registrar Entrada', registerExit: 'Registrar Saída', selectProduct: 'Selecionar produto...' },
      purchases: { title: 'Compras', suppliers: 'Fornecedores', purchaseOrders: 'Ordens de Compra', newSupplier: 'Novo Fornecedor', newOrder: 'Nova Ordem', supplier: 'Fornecedor', contact: 'Contato', email: 'Email', phone: 'Telefone', address: 'Endereço', city: 'Cidade', country: 'País', notes: 'Notas', searchSuppliers: 'Buscar fornecedores...', noSuppliers: 'Nenhum fornecedor registrado', editSupplier: 'Editar Fornecedor', createSupplier: 'Criar Fornecedor', deactivateSupplier: 'Desativar este fornecedor?', orderNumber: 'N° Ordem', orderDate: 'Data da Ordem', expectedDate: 'Data Esperada', status: 'Status', total: 'Total', noOrders: 'Nenhuma ordem de compra', loadingSuppliers: 'Carregando fornecedores...', loadingOrders: 'Carregando ordens...', products: 'Produtos', addProduct: '+ Adicionar produto', selectSupplier: 'Selecionar fornecedor...', selectProduct: 'Selecionar produto...', quantity: 'Qtd', unitCost: 'Custo/u', createOrder: 'Criar Ordem', markAsSent: 'Marcar como Enviada', markAsReceived: 'Marcar como Recebida', received: 'recebidos', states: { draft: 'Rascunho', sent: 'Enviada', partial: 'Parcial', received: 'Recebida', cancelled: 'Cancelada' } },
      sales: { title: 'Vendas', customers: 'Clientes', salesOrders: 'Ordens de Venda', newCustomer: 'Novo Cliente', newOrder: 'Nova Venda', customer: 'Cliente', type: 'Tipo', person: 'Pessoa', company: 'Empresa', document: 'CPF/CNPJ', creditLimit: 'Limite de Crédito', pendingBalance: 'Saldo Pendente', owes: 'Deve', noCustomers: 'Nenhum cliente registrado', searchCustomers: 'Buscar clientes...', loadingCustomers: 'Carregando clientes...', loadingOrders: 'Carregando ordens...', editCustomer: 'Editar Cliente', createCustomer: 'Criar Cliente', deactivateCustomer: 'Desativar este cliente?', orderNumber: 'N° Ordem', orderDate: 'Data da Ordem', deliveryDate: 'Data de Entrega', status: 'Status', total: 'Total', noOrders: 'Nenhuma ordem de venda', selectCustomer: 'Selecionar cliente...', selectProduct: 'Selecionar produto...', deliveryAddress: 'Endereço de Entrega', paymentMethod: 'Método de Pagamento', paymentMethods: { cash: 'Dinheiro', transfer: 'Transferência', card: 'Cartão', credit: 'Crédito' }, createSale: 'Criar Venda', paid: 'Pago', units: 'unidades', insufficientStock: 'Estoque insuficiente', states: { draft: 'Rascunho', confirmed: 'Confirmada', inProcess: 'Em Processo', shipped: 'Enviada', delivered: 'Entregue', cancelled: 'Cancelada' }, actions: { confirm: 'Confirmar', inProcess: 'Em Processo', markShipped: 'Marcar Enviada', markDelivered: 'Marcar Entregue' } },
      warehouses: { title: 'Armazéns', transfers: 'Transferências', newWarehouse: 'Novo Armazém', newTransfer: 'Nova Transferência', main: 'Principal', address: 'Endereço', city: 'Cidade', phone: 'Telefone', manager: 'Responsável', edit: 'Editar', deactivate: 'Desativar este armazém?', code: 'Código', name: 'Nome', editWarehouse: 'Editar Armazém', origin: 'Armazém Origem', destination: 'Armazém Destino', products: 'Produtos', addProduct: '+ Adicionar produto', createTransfer: 'Criar Transferência', noTransfers: 'Sem transferências', send: 'Enviar', confirmReception: 'Confirmar Recebimento', selectOrigin: 'Selecionar...', selectProduct: 'Selecionar...', units: 'unidades', notesOptional: 'Notas opcionais...', selectOriginDestination: 'Selecione origem, destino e pelo menos um produto', states: { pending: 'Pendente', inTransit: 'Em Trânsito', completed: 'Concluída', cancelled: 'Cancelada' } },
      costs: { title: 'Análise de Custos', inventoryCost: 'Custo Estoque (FIFO)', saleValue: 'Valor Venda', grossMargin: 'Margem Bruta', marginPercent: '% Margem', topProducts: 'Top 5 Produtos por Valor em Estoque', salePrice: 'preço venda', activeLots: 'Lotes Ativos', noLots: 'Não há lotes ativos', inventoryLots: 'Lotes de Inventário', noLotsRegistered: 'Nenhum lote registrado', lot: 'Lote', available: 'Disponível', unitCost: 'Custo Unit.', lotValue: 'Valor Lote', totalStockValue: 'Valor Total em Estoque (FIFO)', weightedAvgCost: 'Custo Médio Ponderado', priceHistory: 'Histórico de Preços', changes: 'alterações', noPriceChanges: 'Sem alterações de preço', from: 'De', to: 'Para', noProductsWithCost: 'Nenhum produto com custo registrado' },
      reports: { title: 'Relatórios', executiveDashboard: 'Dashboard Executivo', kpiSummary: 'Resumo de KPIs e indicadores chave', exportPDF: 'PDF', exportExcel: 'Excel', inventoryValue: 'Valor do Inventário', itemsInStock: 'Itens em Estoque', products: 'produtos', entriesMonth: 'Entradas do Mês', exitsMonth: 'Saídas do Mês', lowStockProducts: 'Produtos Estoque Baixo', requiresAttention: 'Requerem atenção', outOfStock: 'Sem Estoque', depleted: 'Esgotados', inventoryRotation: 'Rotação de Inventário', avgReplacement: 'Média de reposição', days: 'dias', topSoldProducts: 'Top 5 Produtos Mais Vendidos', noSalesThisMonth: 'Sem dados de vendas este mês', categoryDistribution: 'Distribuição por Categoria', items: 'itens' },
      integrations: { title: 'Integrações eCommerce', subtitle: 'Conecte seu inventário com lojas online', shopify: 'Shopify', shopifyDesc: 'Sincronize produtos e pedidos com Shopify', woocommerce: 'WooCommerce', woocommerceDesc: 'Conecte com WordPress + WooCommerce', mercadolibre: 'MercadoLibre', mercadolibreDesc: 'Sincronize anúncios e vendas', tiendanube: 'TiendaNube', tiendanubeDesc: 'Integração com TiendaNube', connected: 'Ativo', disconnected: 'Inativo', sync: 'Sincronizar', syncing: 'Sincronizando...', lastSync: 'Última sincronização', noIntegrations: 'Sem integrações', noIntegrationsDesc: 'Conecte sua primeira loja online', newIntegration: 'Nova Integração', addIntegration: 'Adicionar Integração', editIntegration: 'Editar Integração', configure: 'Configurar', selectPlatform: 'Selecione a plataforma:', storeName: 'Nome da loja', storeUrl: 'URL da loja', apiKey: 'API Key / Client ID', apiSecret: 'API Secret / Access Token', credentialsWarning: 'As credenciais são armazenadas de forma segura.', deleteConfirm: 'Excluir esta integração?', loading: 'Carregando integrações...' },
      audit: { title: 'Auditoria do Sistema', description: 'Histórico de todas as ações realizadas', noLogs: 'Nenhum registro de auditoria', loading: 'Carregando auditoria...', records: 'registros', allTables: 'Todas as tabelas', allActions: 'Todas as ações', in: 'em', system: 'Sistema', previousData: 'Dados anteriores', newData: 'Novos dados', tables: { products: 'Produtos', movements: 'Movimentos' }, actions: { create: 'Criar', update: 'Atualizar', delete: 'Excluir' } },
      common: { save: 'Salvar', cancel: 'Cancelar', delete: 'Excluir', edit: 'Editar', create: 'Criar', add: 'Adicionar', close: 'Fechar', confirm: 'Confirmar', loading: 'Carregando...', search: 'Buscar', filter: 'Filtrar', export: 'Exportar', import: 'Importar', yes: 'Sim', no: 'Não', active: 'Ativo', inactive: 'Inativo', status: 'Status', date: 'Data', total: 'Total', subtotal: 'Subtotal', discount: 'Desconto', taxes: 'Impostos', noPermission: 'Sem permissão', actions: 'Ações', select: 'Selecionar...', suggestion: 'Sugestão', confidence: 'confiança', apply: 'Aplicar', all: 'Todas', noCategory: 'Sem categoria', perUnit: 'Por unidade', retry: 'Tentar novamente', noData: 'Sem dados', view: 'Ver', optional: 'opcional' },
      settings: { title: 'Configurações', language: 'Idioma', currency: 'Moeda', theme: 'Tema', themes: { dark: 'Escuro', light: 'Claro', system: 'Sistema' } },
      currencies: { USD: 'Dólar americano', EUR: 'Euro', UYU: 'Peso uruguaio', ARS: 'Peso argentino', BRL: 'Real brasileiro' },
      errors: {
        loadingError: 'Erro ao carregar',
        tryAgain: 'Tente novamente',
        timeout: 'Tempo de espera esgotado',
        slowConnection: 'Conexão lenta. Verifique sua internet.',
        offline: 'Sem conexão',
        checkConnection: 'Verifique sua conexão com a internet',
        serverError: 'Erro do servidor',
        unknownError: 'Erro desconhecido',
      },
      modules: {
        messages: 'Mensagens', comercial: 'Comercial', finance: 'Finanças', projects: 'Projetos',
        workshop: 'Oficina', wms: 'WMS', costs: 'Custos', demandPlanning: 'Planejamento de Demanda',
        quality: 'Qualidade (QMS)', serials: 'Seriais', traceability: 'Rastreabilidade',
        returns: 'Devoluções', bom: 'BOM', assemblies: 'Montagens',
        inventory: 'Inventário', operations: 'Operações', analysis: 'Análise',
        control: 'Controle', config: 'Configurações', home: 'Início', chat: 'Chat',
      },
      theme: { lightMode: 'Modo Claro', darkMode: 'Modo Escuro' },
      notifications: {
        title: 'Notificações', noStock: 'Sem estoque', lowStock: 'Estoque baixo', depleted: 'Esgotado',
        markAllRead: 'Marcar tudo como lido', noNotifications: 'Sem notificações', markAll: 'Marcar todas',
        loading: 'Carregando...', noNotificationsProject: 'Sem notificações', viewAll: 'Ver todas as notificações',
        now: 'Agora', markRead: 'Marcar como lida', deleteNotif: 'Excluir',
      },
      shortcuts: {
        title: 'Atalhos de Teclado', globalSearch: 'Busca global', scanBarcode: 'Escanear código de barras',
        newProduct: 'Novo produto', newMovement: 'Novo movimento', closeModal: 'Fechar modal',
        pressEscToClose: 'Pressione Esc para fechar',
      },
      onboarding: {
        welcome: 'Bem-vindo ao Vanguard',
        welcomeDesc: 'Seu sistema completo de gestão de inventário. Vamos guiá-lo pelas funções principais.',
        sideNav: 'Navegação lateral',
        sideNavDesc: 'Use a barra lateral para acessar todos os módulos: Estoque, Vendas, Compras, Relatórios e mais.',
        quickSearch: 'Busca rápida',
        quickSearchDesc: 'Pressione Ctrl+K a qualquer momento para buscar produtos, módulos ou ações rapidamente.',
        aiChatbot: 'Chatbot com IA',
        aiChatbotDesc: 'Use o assistente de IA no canto inferior direito para obter ajuda, consultar dados ou executar ações.',
        skip: 'Pular', skipTour: 'Pular tour', start: 'Começar', next: 'Próximo',
      },
      taller: {
        title: 'Oficina', reception: 'Recepção', diagnosis: 'Diagnóstico', quote: 'Orçamento',
        approved: 'Aprovado', rejected: 'Rejeitado', inRepair: 'Em Reparo', repaired: 'Reparado',
        invoiced: 'Faturado', readyDelivery: 'Pronto para Entrega', delivered: 'Entregue', cancelled: 'Cancelado',
        newOrder: 'Nova Ordem', orders: 'Ordens', history: 'Histórico', stock: 'Peças',
        stats: 'Estatísticas', client: 'Cliente', device: 'Equipamento', brand: 'Marca', model: 'Modelo',
        serial: 'Serial', warranty: 'Garantia', accessories: 'Acessórios', problem: 'Problema Relatado',
        assignTech: 'Atribuir Técnico', save: 'Salvar', createOrder: 'Criar Ordem',
        sendQuote: 'Enviar Orçamento', startRepair: 'Iniciar Reparo', finishRepair: 'Finalizar Reparo',
        generateInvoice: 'Gerar Fatura', readyForDelivery: 'Pronto para Entrega', markDelivered: 'Marcar Entregue',
        cancel: 'Cancelar Ordem', addNote: 'Adicionar Nota', addPart: 'Adicionar Peça',
        noOrders: 'Sem ordens', searchOrders: 'Buscar ordens...', orderDetail: 'Detalhes da Ordem',
        notifyClient: 'Notificar Cliente', timeline: 'Linha do tempo', notes: 'Notas',
        parts: 'Peças utilizadas', subtotal: 'Subtotal', discount: 'Desconto', tax: 'Imposto',
        total: 'Total', processing: 'Processando...', noTechnician: 'Sem técnico atribuído',
        loading: 'Carregando...',
      },
      proyectos: {
        title: 'Projetos', newProject: 'Novo Projeto', tasks: 'Tarefas', kanban: 'Kanban',
        list: 'Lista', calendar: 'Calendário', activity: 'Atividade', time: 'Tempo',
        members: 'Membros', settings: 'Configurações', priority: 'Prioridade',
        high: 'Alta', medium: 'Média', low: 'Baixa', urgent: 'Urgente',
        dueDate: 'Data limite', assignedTo: 'Atribuído a', status: 'Status',
        inProgress: 'Em andamento', completed: 'Concluído', pending: 'Pendente',
        noProjects: 'Sem projetos', noTasks: 'Sem tarefas', addTask: 'Adicionar Tarefa',
        addColumn: 'Adicionar Coluna', moveTask: 'Mover Tarefa', duplicateTask: 'Duplicar Tarefa',
        deleteTask: 'Excluir Tarefa', editTask: 'Editar Tarefa', comments: 'Comentários',
        attachments: 'Anexos', timeTracked: 'Tempo Registrado', description: 'Descrição',
      },
      chat: {
        title: 'Mensagens', search: 'Buscar conversa...', newConversation: 'Nova Conversa',
        typeMessage: 'Digite uma mensagem...', noConversations: 'Sem conversas',
        participants: 'Participantes', selectConversation: 'Selecione uma conversa',
        send: 'Enviar', online: 'Online', offline: 'Offline',
      },
      qms: {
        title: 'Qualidade (QMS)', dashboard: 'Painel', incomingInspection: 'Inspeção de Recebimento',
        processControl: 'Controle de Processo', nonConformities: 'Não Conformidades', capas: 'CAPAs',
        certificates: 'Certificados', recalls: 'Recalls', audits: 'Auditorias',
        approved: 'Aprovado', rejected: 'Rejeitado', pending: 'Pendente',
        inspector: 'Inspetor', result: 'Resultado', observations: 'Observações',
      },
      finanzas: {
        title: 'Finanças', accounts: 'Contas', transactions: 'Transações',
        accountsReceivable: 'Contas a Receber', accountsPayable: 'Contas a Pagar',
        cashFlow: 'Fluxo de Caixa', balance: 'Saldo', income: 'Receitas', expenses: 'Despesas',
        bankAccount: 'Conta Bancária', cash: 'Dinheiro', credit: 'Crédito',
        currency: 'Moeda', amount: 'Valor', date: 'Data', concept: 'Conceito',
      },
      wmsModule: {
        title: 'WMS', dashboard: 'Painel', locations: 'Localizações', receiving: 'Recebimento',
        picking: 'Picking', inventory: 'Inventário', movements: 'Movimentos',
        slotting: 'Slotting', config: 'Configurações', zone: 'Zona', aisle: 'Corredor',
        rack: 'Estante', level: 'Nível', position: 'Posição',
      },
      demandModule: {
        title: 'Planejamento de Demanda', dashboard: 'Painel', forecast: 'Previsão',
        alerts: 'Alertas', replenishment: 'Reposição', trends: 'Tendências',
        config: 'Configurações', safetyStock: 'Estoque de Segurança', reorderPoint: 'Ponto de Reposição',
        leadTime: 'Tempo de Entrega',
      },
      rma: {
        title: 'Devoluções (RMA)', requested: 'Solicitada', approved: 'Aprovada',
        rejected: 'Rejeitada', received: 'Recebida', processing: 'Em processamento',
        resolved: 'Resolvida', reason: 'Motivo', resolution: 'Resolução',
      },
      bom: {
        title: 'Lista de Materiais (BOM)', components: 'Componentes', quantity: 'Quantidade',
        level: 'Nível', parent: 'Pai', child: 'Filho',
      },
      assemblies: {
        title: 'Montagens', newAssembly: 'Nova Montagem', status: 'Status',
        inProgress: 'Em Andamento', completed: 'Concluída', pending: 'Pendente',
      },
      seriales: {
        title: 'Seriais', serialNumber: 'Número de Série', status: 'Status',
        active: 'Ativo', inactive: 'Inativo',
      },
      traceability: {
        title: 'Rastreabilidade', lot: 'Lote', origin: 'Origem', destination: 'Destino',
        chain: 'Cadeia de Custódia',
      },
    },
  },
};

const getBrowserLanguage = (): string => {
  if (typeof window === 'undefined') return 'es';
  const lang = navigator.language.split('-')[0];
  return ['es', 'en', 'pt'].includes(lang) ? lang : 'es';
};

const getSavedLanguage = (): string => {
  if (typeof window === 'undefined') return 'es';
  return localStorage.getItem('vanguard_language') || getBrowserLanguage();
};

i18n.use(initReactI18next).init({
  resources,
  lng: getSavedLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

export default i18n;

export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    localStorage.setItem('vanguard_language', lang);
  }
};

export const availableLanguages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
];