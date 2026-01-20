import { Category, Product, Movement } from '@/types';

// ============================================
// CATEGORÍAS PREDEFINIDAS
// ============================================

export const CATEGORIAS: Category[] = [
  { id: 'est', nombre: 'Estación de Servicio', color: 'blue' },
  { id: 'fer', nombre: 'Ferretería', color: 'orange' },
  { id: 'edi', nombre: 'Edintor', color: 'purple' },
  { id: 'pap', nombre: 'Papelería', color: 'green' },
  { id: 'ofi', nombre: 'Oficina', color: 'cyan' },
  { id: 'emb', nombre: 'Embalaje', color: 'pink' },

];

export const CATEGORIA_NOMBRES = CATEGORIAS.map((c) => c.nombre);

// ============================================
// COLORES POR CATEGORÍA (para badges)
// ============================================

export const CATEGORY_COLORS: Record<string, string> = {
  'Estación de Servicio': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Ferretería': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Edintor': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Papelería': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Oficina': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Embalaje': 'bg-pink-500/20 text-pink-300 border-pink-500/30',

};

// ============================================
// KEYWORDS PARA SUGERENCIA DE CATEGORÍA (IA)
// ============================================

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Estación de Servicio': [
    'aceite', 'filtro', 'lubricante', 'grasa', 'aditivo', 'refrigerante',
    'líquido', 'freno', 'motor', '4t', '2t', 'transmisión', 'hidráulico',
    'combustible', 'gasolina', 'diesel', 'nafta'
  ],
  'Ferretería': [
    'tornillo', 'clavo', 'tuerca', 'arandela', 'perno', 'bisagra',
    'cerradura', 'candado', 'llave', 'martillo', 'destornillador',
    'alicate', 'pinza', 'sierra', 'taladro', 'broca'
  ],
  'Edintor': [
    'pintura', 'brocha', 'rodillo', 'sellador', 'masilla', 'thinner',
    'barniz', 'esmalte', 'impermeabilizante', 'cemento', 'cal', 'yeso'
  ],
  'Papelería': [
    'papel', 'cuaderno', 'lapicero', 'lápiz', 'borrador', 'carpeta',
    'folder', 'sobre', 'cinta', 'pegamento', 'tijera', 'regla',
    'marcador', 'resaltador', 'grapa', 'clip'
  ],

  'Oficina': [
    'escritorio', 'silla', 'archivador', 'estante', 'computadora',
    'monitor', 'teclado', 'mouse', 'impresora', 'tinta', 'toner',
    'calculadora', 'teléfono', 'lámpara', 'organizador'
  ],
  'Embalaje': [
    'bolsa', 'cinta', 'nylon', 'empaque', 'polipropileno', 'basura',
    'film', 'stretch', 'burbuja', 'cartón', 'caja'
  ],
};

// ============================================
// CONFIGURACIÓN DE IA
// ============================================

export const AI_CONFIG = {
  // Umbral Z-score para detección de anomalías
  ANOMALY_THRESHOLD: 2.5,
  
  // Mínimo de movimientos para predicciones confiables
  MIN_MOVEMENTS_FOR_PREDICTION: 2,
  
  // Confianza base para predicciones
  BASE_CONFIDENCE: 0.5,
  
  // Incremento de confianza por movimiento histórico
  CONFIDENCE_INCREMENT: 0.05,
  
  // Máxima confianza permitida
  MAX_CONFIDENCE: 0.95,
  
  // Umbral para sugerencia de categoría
  CATEGORY_SUGGESTION_THRESHOLD: 0.5,
  
  // Días de alerta para stock bajo
  LOW_STOCK_ALERT_DAYS: 14,
};

// ============================================
// CONFIGURACIÓN GENERAL
// ============================================

export const APP_CONFIG = {
  NAME: 'InventoryAI',
  DESCRIPTION: 'Sistema de Gestión de Inventarios con IA',
  VERSION: '1.0.0',
  
  // Paginación por defecto
  DEFAULT_PAGE_SIZE: 20,
  
  // Formato de código de producto
  CODIGO_PATTERN: /^[A-Z]{2,4}-\d{3,4}$/,
  CODIGO_EXAMPLE: 'HER-001',
};

// ============================================
// DATOS DE EJEMPLO (para desarrollo)
// ============================================

export const SAMPLE_PRODUCTS: Product[] = [
  // ========== IMAGEN 1 - STOCKS ==========
  { codigo: 'A4T', descripcion: 'ACEITE 4T X 4LT 20W50 X 4LT', precio: 1254.4, categoria: 'Estación de Servicio', stock: 6, stockMinimo: 5 },
  { codigo: 'A2T', descripcion: 'ACEITE 2T X 1LT', precio: 378.69, categoria: 'Estación de Servicio', stock: 0, stockMinimo: 5 },
  { codigo: 'A15W', descripcion: 'ACEITE 15W40 TURBO DIESEL X 4LT', precio: 1044, categoria: 'Estación de Servicio', stock: 4, stockMinimo: 5 },
  { codigo: 'ALUB', descripcion: 'ACEITE LUBAN 30PLUS X 4LT', precio: 1198.2, categoria: 'Estación de Servicio', stock: 9, stockMinimo: 5 },
  { codigo: 'LHID4', descripcion: 'LIQUIDO HIDRAULICO X 4LT', precio: 1021.8, categoria: 'Ferretería', stock: 3, stockMinimo: 5 },
  { codigo: 'ASN', descripcion: 'AEROSOL SPRAY NEGRO', precio: 0, categoria: 'Ferretería', stock: 5, stockMinimo: 5 },
  { codigo: 'ASA', descripcion: 'AEROSOL SPRAY AMARILLO', precio: 0, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'SJUN', descripcion: 'SELLA JUNTA 368gr Permatex', precio: 1352.46, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'POXI', descripcion: 'POXIPOL', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'TRAB', descripcion: 'TRABASIL', precio: 1114.75, categoria: 'Ferretería', stock: 3, stockMinimo: 5 },
  { codigo: 'TEF', descripcion: 'TEFLON', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'WD40', descripcion: 'WD40', precio: 0, categoria: 'Ferretería', stock: 12, stockMinimo: 5 },
  { codigo: 'FERRETERIA', descripcion: 'GRASA X1KG', precio: 0, categoria: 'Estación de Servicio', stock: 3, stockMinimo: 5 },
  { codigo: 'TRAPOS', descripcion: 'TRAPOS (BOLSA)', precio: 1057.38, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'HLIJA', descripcion: 'HOJAS DE LIJA', precio: 0, categoria: 'Ferretería', stock: 9, stockMinimo: 5 },
  { codigo: 'CINAISL', descripcion: 'CINTA AISLADORA', precio: 0, categoria: 'Ferretería', stock: 4, stockMinimo: 5 },
  { codigo: 'SROS', descripcion: 'SELLA ROSCA', precio: 0, categoria: 'Ferretería', stock: 3, stockMinimo: 5 },
  { codigo: 'BOBEST', descripcion: 'BOBINA DE ESTAÑO X 500GR', precio: 1139.34, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'SJUN2', descripcion: 'SELLA JUNTA', precio: 975.41, categoria: 'Ferretería', stock: 3, stockMinimo: 5 },
  { codigo: 'VIBRO', descripcion: 'VIBROGRABADOR (NUEVO)', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'SWADF', descripcion: 'SOLDADORES WADFOW (NUEVOS)', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'GUAN', descripcion: 'GUANTES (HGNG02-L) CAJA 100', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'PINC', descripcion: 'PINCELES (X UNIDAD)', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'DEST', descripcion: 'DESTORNILLADORES TORX', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HTRIN', descripcion: 'REPUESTO TRINCHETA HKNSB112 (X UNIDAD)', precio: 0, categoria: 'Edintor', stock: 6, stockMinimo: 5 },
  { codigo: 'TCONTR', descripcion: 'TERMO CONTRAIBLE 4MM (X METRO)', precio: 23.77, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'NYL', descripcion: 'NYLON DE MANO (UNIDAD)', precio: 0, categoria: 'Embalaje', stock: 20, stockMinimo: 5 },
  { codigo: 'CINEMP', descripcion: 'CINTA DE EMPAQUE (UNIDAD)', precio: 0, categoria: 'Embalaje', stock: 72, stockMinimo: 5 },
  { codigo: 'CINFRAG', descripcion: 'CINTA FRAGIL', precio: 0, categoria: 'Embalaje', stock: 0, stockMinimo: 5 },
  { codigo: 'POLIPRO', descripcion: 'BOLSA POLIPROPILENO X PAQUETE', precio: 0, categoria: 'Embalaje', stock: 1, stockMinimo: 5 },
  { codigo: 'BOLBASU', descripcion: 'BOLSA BASURA', precio: 0, categoria: 'Embalaje', stock: 10, stockMinimo: 5 },
  { codigo: 'GRAMP', descripcion: 'GRAMPAS X CAJA', precio: 0, categoria: 'Papelería', stock: 3, stockMinimo: 5 },
  { codigo: 'BOLGOM', descripcion: 'BOLSA DE GOMITAS X200GR', precio: 81.15, categoria: 'Papelería', stock: 4, stockMinimo: 5 },
  { codigo: 'MANI', descripcion: 'MANILAS X1000', precio: 370.08, categoria: 'Papelería', stock: 3, stockMinimo: 5 },
  { codigo: 'MARPER', descripcion: 'MARCADORES PERMANENTES', precio: 21, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'MARPIZ', descripcion: 'MARCADORES PIZARRON', precio: 0, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'AGEN', descripcion: 'AGENDA INGCO', precio: 0, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'TIJ', descripcion: 'TIJERA', precio: 0, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'LAP', descripcion: 'LAPICERAS', precio: 0, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'RES', descripcion: 'RESALTADOR (FLUOR)', precio: 20, categoria: 'Papelería', stock: 6, stockMinimo: 5 },
  { codigo: 'TRIN', descripcion: 'TRINCHETA', precio: 0, categoria: 'Oficina', stock: 1, stockMinimo: 5 },
  { codigo: 'TONXER', descripcion: 'TONER XEROX B230', precio: 0, categoria: 'Oficina', stock: 1, stockMinimo: 5 },
  { codigo: 'TONWX', descripcion: 'TONER WX-3330', precio: 0, categoria: 'Oficina', stock: 1, stockMinimo: 5 },
  { codigo: 'TONMS', descripcion: 'TONER MS521', precio: 0, categoria: 'Oficina', stock: 1, stockMinimo: 5 },
  { codigo: 'TONTN', descripcion: 'TONER TN1060', precio: 0, categoria: 'Oficina', stock: 0, stockMinimo: 5 },
  { codigo: 'MOU', descripcion: 'MOUSE', precio: 0, categoria: 'Oficina', stock: 2, stockMinimo: 5 },
  { codigo: 'GORROCV', descripcion: 'GORRO CV', precio: 0, categoria: 'Edintor', stock: 21, stockMinimo: 5 },
  { codigo: 'LAPINGCO', descripcion: 'LAPICERA INGCO', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },

  // ========== IMAGEN 2 - STOCKS ==========
  { codigo: 'NEMPAG', descripcion: 'NYLON EMPAQUE GRANDE', precio: 0, categoria: 'Ferretería', stock: 13, stockMinimo: 5 },
  { codigo: 'MEDCOMPR', descripcion: 'MEDIDOR DE COMPRESION DIESEL', precio: 4291, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'JCORCHO', descripcion: 'JUNTA DE CORCHO', precio: 318, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'HSDX10100', descripcion: 'TORX T10 INM', precio: 0, categoria: 'Edintor', stock: 9, stockMinimo: 5 },
  { codigo: 'HPTW200N1', descripcion: 'TORQUIMETRO INGCO', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'ASG', descripcion: 'AEROSOL GRIS', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'SDBIM11PH263', descripcion: 'SET PUNTAS PH LARGAS', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HCT4001', descripcion: 'PRECINTO 40CM', precio: 0, categoria: 'Ferretería', stock: 97, stockMinimo: 5 },
  { codigo: 'HCT2001', descripcion: 'PRECINTO 20CM', precio: 0, categoria: 'Ferretería', stock: 42, stockMinimo: 5 },
  { codigo: 'WGX1K03', descripcion: 'GOTITA WADFOW', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'TCONTR2', descripcion: 'TERMOCONTRAIBLE 2MM', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'LJGR400', descripcion: 'LIJA GRANO 400', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'LJGR240', descripcion: 'LIJA GRANO 240', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'ASB', descripcion: 'AEROSOL BLANCO', precio: 0, categoria: 'Ferretería', stock: 2, stockMinimo: 5 },
  { codigo: 'TECL', descripcion: 'TECLADO', precio: 0, categoria: 'Oficina', stock: 0, stockMinimo: 5 },
  { codigo: 'TCONTR3', descripcion: 'TERMOCONTRAIBLE 3MM (X METRO)', precio: 27.87, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'REMEL', descripcion: 'REMERA TALLE L', precio: 0, categoria: 'Edintor', stock: 5, stockMinimo: 5 },
  { codigo: 'GRALIQUI', descripcion: 'GRASA LIQUIDA SEALFIX', precio: 237.7, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'PRUSSAZU', descripcion: 'AZUL DE PRUSSIAN REVELADOR', precio: 237.7, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'ESMALSINT', descripcion: 'ESMALTE SINTETICO AMARILLO', precio: 1160, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'SCEPI', descripcion: 'SET DE CEPILLOS DE ALAMBRE WADFOW', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'MACE', descripcion: 'MACETA DE GOMA INGCO', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'LENPRO', descripcion: 'LENTES PROTECTORES', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'CINTWAD', descripcion: 'CINTERO WADFOW', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'SOLEST', descripcion: 'SOLDADOR DE ESTAÑO', precio: 0, categoria: 'Edintor', stock: 20, stockMinimo: 5 },
  { codigo: 'TRINWAD', descripcion: 'TRINCHETA WADFOW', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'BANDER', descripcion: 'BANDERITAS ADHESIVAS', precio: 26.3, categoria: 'Papelería', stock: 3, stockMinimo: 5 },
  { codigo: 'CARP', descripcion: 'CARPETAS ARCHIVADORAS', precio: 109, categoria: 'Papelería', stock: 0, stockMinimo: 5 },
  { codigo: 'ESCAWAD', descripcion: 'ESCALERA WADFOW 5 ESCALONES', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'MART300G', descripcion: 'MARTILLO 300G', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'FILCAR', descripcion: 'FILTRO DE CARBONO', precio: 0, categoria: 'Edintor', stock: 10, stockMinimo: 5 },
  { codigo: 'LIMCARB', descripcion: 'LIMPIA CARBURADOR', precio: 122, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'CUAIN', descripcion: 'CUADERNO INGCO', precio: 0, categoria: 'Edintor', stock: 21, stockMinimo: 5 },
  { codigo: 'REMEXL', descripcion: 'REMERA TALLE XL', precio: 0, categoria: 'Edintor', stock: 18, stockMinimo: 5 },
  { codigo: 'ALFC', descripcion: 'ALFOMBRA CAMIONETA', precio: 557.38, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'PAROS', descripcion: 'PRENSA AROS', precio: 381.15, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'PINC1', descripcion: 'PINCEL 1"', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'WAK1502', descripcion: 'LAPICERA WADFOW', precio: 0, categoria: 'Edintor', stock: 11, stockMinimo: 5 },
  { codigo: 'HCJLW0110', descripcion: 'PINZA MORSA 10"', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'AMN1031', descripcion: 'DADO IMPACTO 10 MM P/TORNILLADORA', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'AMN1231', descripcion: 'DADO IMPACTO 12 P/TORNILLADORA', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'WBV1A08', descripcion: 'MORSA 8"', precio: 4336.07, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'SDBIM11PH223', descripcion: 'PUNTA PHILLIPS CORTA', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HWSP102429', descripcion: 'PELACABLE', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'GUANTES', descripcion: 'GUANTES NITRILO N', precio: 2.25, categoria: 'Edintor', stock: 700, stockMinimo: 50 },

  // ========== IMAGEN 3 - STOCKS ==========
  { codigo: 'DCM610002', descripcion: 'PINZA AMPERIMETRICA AC DC', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'ENDU', descripcion: 'ENDUIDO 1 KG', precio: 50.82, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'MANG', descripcion: 'MANGUERA NIVEL DE AGUA', precio: 430, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'SI00108', descripcion: 'SOLDADOR ESTAÑO 100W', precio: 0, categoria: 'Ferretería', stock: 1, stockMinimo: 5 },
  { codigo: 'HRUH8808', descripcion: 'MACETA DE GOMA', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'SDBIM21HL133', descripcion: 'PUNTA PHILLIPS-PALETA', precio: 0, categoria: 'Edintor', stock: 18, stockMinimo: 5 },
  { codigo: 'MTEMP', descripcion: 'MEDIDOR DE TEMP PARA CAMIONETA', precio: 647.54, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'GO', descripcion: 'GASOIL', precio: 50.14, categoria: 'Estación de Servicio', stock: 20, stockMinimo: 5 },
  { codigo: 'AKSD68303', descripcion: 'PUNTAS LLAVE DE IMPACTO', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HKPHS0401', descripcion: 'SET DE GANCHOS', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'WXP1302', descripcion: 'CINTA TEFLON 3/4', precio: 0, categoria: 'Edintor', stock: 6, stockMinimo: 5 },
  { codigo: 'FILRET', descripcion: 'FILTRO P/VALVULA DE RETENCION 1"', precio: 77.87, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'TEETF1', descripcion: 'TEE TF 1"', precio: 39.34, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'CODTF1', descripcion: 'CODO TF 1"', precio: 26.23, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'INS1', descripcion: 'CUPLA C/INSERTO DE ROSCA 1"', precio: 162.3, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'VPASO1', descripcion: 'VALVULA DE PASO TF 1"', precio: 811.48, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'CANTF', descripcion: 'CAÑO TERMOFUSION 1"', precio: 433.61, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'TERR', descripcion: 'TERRAJA 1"', precio: 401.64, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'RED1PPL', descripcion: 'REDUCCION PPL 1 A 1 Y 1/4', precio: 56.56, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'VRET', descripcion: 'VALVULA DE RETENCION 1"', precio: 490.98, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'BRUN', descripcion: 'BRUÑIDOR DE CILINDROS', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'GASSOP', descripcion: 'GAS PARA SOPLETE', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'BARSIL', descripcion: 'BARRA DE SILICONA CALIENTE', precio: 0, categoria: 'Ferretería', stock: 25, stockMinimo: 5 },
  { codigo: 'WHU2905', descripcion: 'ABRAZADERA 19 - 44', precio: 0, categoria: 'Edintor', stock: 18, stockMinimo: 5 },
  { codigo: 'WPN4H45', descripcion: 'CINTA SEGURIDAD', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'PRE40', descripcion: 'PRECINTOS 400 MM', precio: 2.9508, categoria: 'Ferretería', stock: 109, stockMinimo: 5 },
  { codigo: 'MANILA', descripcion: 'MANILA 40X60 X1000', precio: 573, categoria: 'Ferretería', stock: 3, stockMinimo: 5 },
  { codigo: 'PRE20', descripcion: 'PRECINTOS 3.6 X 200 MM', precio: 1.1393, categoria: 'Ferretería', stock: 89, stockMinimo: 5 },
  { codigo: 'NAF', descripcion: 'NAFTA', precio: 78.54, categoria: 'Estación de Servicio', stock: 20, stockMinimo: 5 },
  { codigo: 'LAMH', descripcion: 'LAMINA HERMETITE RED 1.0MM ROLLO', precio: 1434, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'MESMER', descripcion: 'MANGO ESMERILADOR', precio: 713.11, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'PESM', descripcion: 'PASTA ESMERIL', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'QUER', descripcion: 'QUEROSENO X1LT', precio: 55.8, categoria: 'Estación de Servicio', stock: 18, stockMinimo: 5 },
  { codigo: 'WSP1208', descripcion: 'JUEGO DE LLAVES COMBINADAS', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'WPS2604', descripcion: 'JUEGO DE PINZAS SACA SEGUROS', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HCJLW0210', descripcion: 'PINZA TIPO MORSA', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HSTH81500', descripcion: 'MACETA INGCO 1500G', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'HMHS81001', descripcion: 'MARTILLO INGCO 100G', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'WPB1915', descripcion: 'PINCEL WADFOW 1,5"', precio: 0, categoria: 'Edintor', stock: 0, stockMinimo: 5 },
  { codigo: 'HKPHS0401B', descripcion: 'JUEGO DE PINCHOS', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'SUP95', descripcion: 'NAFTA SUPER 95 X 1LT', precio: 78.54, categoria: 'Estación de Servicio', stock: 0, stockMinimo: 5 },
  { codigo: 'WFG1602', descripcion: 'SOPLETE FLAMEADOR WADFOW', precio: 0, categoria: 'Edintor', stock: 1, stockMinimo: 5 },
  { codigo: 'GAS', descripcion: 'TUBO DE GAS PARA SOPLETE', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  
  // ========== NUEVOS (encontrados en fotos, no en lista original) ==========
  { codigo: 'INST', descripcion: 'INSTRUMENTOS', precio: 0, categoria: 'Ferretería', stock: 6, stockMinimo: 5 },
  { codigo: 'LHIJA', descripcion: 'LIJAS', precio: 0, categoria: 'Ferretería', stock: 0, stockMinimo: 5 },
  { codigo: 'SUPS95', descripcion: 'SUPER 95', precio: 0, categoria: 'Estación de Servicio', stock: 0, stockMinimo: 5 },
  { codigo: 'VPAS01', descripcion: 'VALVULA DE PASO', precio: 0, categoria: 'Ferretería', stock: 8, stockMinimo: 5 },
];

// Movimientos vacíos para empezar limpio
export const SAMPLE_MOVEMENTS: Movement[] = [];