import { supabase } from '@/lib/supabase';
import { registrarAuditoria } from '@/lib/audit';

// =====================================================
// Facturación electrónica Uruguay (DGI CFE)
// =====================================================
// Esta capa modela los CFE (Comprobantes Fiscales
// Electrónicos) según DGI y prepara el XML, hash y QR.
// La integración real con DGI (firma con certificado +
// envío por web service) se hace en el endpoint
// /api/cfe/firmar — acá generamos la estructura, los
// totales y un QR string que la UI puede mostrar.
//
// Tipos de CFE más comunes:
//   101 = e-Ticket          (consumo final < 10.000 UI)
//   102 = e-Ticket NC
//   103 = e-Ticket ND
//   111 = e-Factura         (con RUT receptor)
//   112 = e-Factura NC
//   113 = e-Factura ND
//   121 = e-Factura Exportación
//   124 = e-Remito
// =====================================================

export type TipoCFE = 101 | 102 | 103 | 111 | 112 | 113 | 121 | 124 | 181;

export type EstadoCFE =
  | 'borrador'
  | 'firmado'
  | 'aceptado_dgi'
  | 'rechazado_dgi'
  | 'anulado';

export interface Receptor {
  tipo: 'rut' | 'ci' | 'pasaporte' | 'otro';
  documento: string;
  nombre: string;
  direccion?: string;
}

export interface LineaCFE {
  productoCodigo?: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
  precioUnitario: number;
  descuentoPct?: number;
  ivaTasa?: 0 | 10 | 22; // 0 exento, 10 mínimo, 22 básica
}

export interface NuevoCFE {
  tipoCFE: TipoCFE;
  origenTipo: 'orden_venta' | 'nota_credito_debito' | 'remito';
  origenId?: string;
  origenCodigo?: string;
  receptor?: Receptor;
  lineas: LineaCFE[];
  moneda?: string;
  tipoCambio?: number;
  notas?: string;
  emitidoPor: string;
}

export interface CFE {
  id: string;
  tipo_cfe: number;
  serie: string;
  numero: number;
  origen_tipo: string;
  origen_id?: string | null;
  origen_codigo?: string | null;
  receptor_tipo?: string | null;
  receptor_documento?: string | null;
  receptor_nombre?: string | null;
  receptor_direccion?: string | null;
  moneda: string;
  tipo_cambio?: number | null;
  monto_neto?: number | null;
  monto_iva?: number | null;
  monto_total: number;
  estado: EstadoCFE;
  cae?: string | null;
  cae_vencimiento?: string | null;
  hash_xml?: string | null;
  qr_url?: string | null;
  rechazo_motivo?: string | null;
  emitido_por?: string | null;
  fecha_emision?: string | null;
  fecha_envio_dgi?: string | null;
  fecha_respuesta_dgi?: string | null;
  notas?: string | null;
  created_at: string;
}

// =====================================================
// CÁLCULO DE TOTALES
// =====================================================

export interface TotalesCFE {
  neto: number;
  iva: number;
  total: number;
  por_tasa: Record<number, { neto: number; iva: number }>;
}

export function calcularTotales(lineas: LineaCFE[]): TotalesCFE {
  const por_tasa: Record<number, { neto: number; iva: number }> = {};
  let neto = 0;
  let iva = 0;

  for (const l of lineas) {
    const tasa = l.ivaTasa ?? 22;
    const subtotal = l.cantidad * l.precioUnitario;
    const desc = (l.descuentoPct || 0) * subtotal / 100;
    const baseImponible = subtotal - desc;
    const ivaLinea = baseImponible * (tasa / 100);

    neto += baseImponible;
    iva += ivaLinea;

    if (!por_tasa[tasa]) por_tasa[tasa] = { neto: 0, iva: 0 };
    por_tasa[tasa].neto += baseImponible;
    por_tasa[tasa].iva += ivaLinea;
  }

  return {
    neto: Math.round(neto * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total: Math.round((neto + iva) * 100) / 100,
    por_tasa,
  };
}

// =====================================================
// EMISIÓN
// =====================================================

interface EmisorConfig {
  rut: string;
  serie_actual: string;
  proximo_numero_e_ticket: number;
  proximo_numero_e_factura: number;
  proximo_numero_nc: number;
  proximo_numero_nd: number;
  proximo_numero_e_remito: number;
  ambiente: string;
}

async function getEmisor(): Promise<EmisorConfig | null> {
  const { data } = await supabase
    .from('cfe_emisor_config')
    .select('*')
    .eq('activo', true)
    .limit(1)
    .maybeSingle();
  return (data as EmisorConfig) || null;
}

function siguienteNumeroSerie(emisor: EmisorConfig, tipoCFE: TipoCFE): { numero: number; campo: string } {
  if (tipoCFE === 101) return { numero: emisor.proximo_numero_e_ticket, campo: 'proximo_numero_e_ticket' };
  if (tipoCFE === 111 || tipoCFE === 121) return { numero: emisor.proximo_numero_e_factura, campo: 'proximo_numero_e_factura' };
  if (tipoCFE === 102 || tipoCFE === 112) return { numero: emisor.proximo_numero_nc, campo: 'proximo_numero_nc' };
  if (tipoCFE === 103 || tipoCFE === 113) return { numero: emisor.proximo_numero_nd, campo: 'proximo_numero_nd' };
  if (tipoCFE === 124) return { numero: emisor.proximo_numero_e_remito, campo: 'proximo_numero_e_remito' };
  return { numero: emisor.proximo_numero_e_ticket, campo: 'proximo_numero_e_ticket' };
}

/**
 * Crea el CFE en estado 'borrador' con sus líneas y totales.
 * No firma todavía — eso lo hace `firmarCFE()`.
 */
export async function crearBorradorCFE(nuevo: NuevoCFE): Promise<CFE | null> {
  const emisor = await getEmisor();
  if (!emisor) {
    console.error('No hay emisor configurado en cfe_emisor_config');
    return null;
  }

  const { numero, campo } = siguienteNumeroSerie(emisor, nuevo.tipoCFE);
  const totales = calcularTotales(nuevo.lineas);

  const { data: cfe, error } = await supabase
    .from('cfe_uy')
    .insert({
      tipo_cfe: nuevo.tipoCFE,
      serie: emisor.serie_actual,
      numero,
      origen_tipo: nuevo.origenTipo,
      origen_id: nuevo.origenId || null,
      origen_codigo: nuevo.origenCodigo || null,
      receptor_tipo: nuevo.receptor?.tipo || null,
      receptor_documento: nuevo.receptor?.documento || null,
      receptor_nombre: nuevo.receptor?.nombre || null,
      receptor_direccion: nuevo.receptor?.direccion || null,
      moneda: nuevo.moneda || 'UYU',
      tipo_cambio: nuevo.tipoCambio || null,
      monto_neto: totales.neto,
      monto_iva: totales.iva,
      monto_total: totales.total,
      estado: 'borrador',
      emitido_por: nuevo.emitidoPor,
      notas: nuevo.notas || null,
    })
    .select()
    .single();

  if (error || !cfe) {
    console.error('crearBorradorCFE error:', error);
    return null;
  }

  // Insertar líneas
  await supabase.from('cfe_uy_lineas').insert(
    nuevo.lineas.map((l, idx) => {
      const subtotal = l.cantidad * l.precioUnitario;
      const desc = (l.descuentoPct || 0) * subtotal / 100;
      return {
        cfe_id: cfe.id,
        numero_linea: idx + 1,
        producto_codigo: l.productoCodigo || null,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        unidad_medida: l.unidadMedida || 'UN',
        precio_unitario: l.precioUnitario,
        descuento_pct: l.descuentoPct || 0,
        iva_tasa: l.ivaTasa ?? 22,
        subtotal: Math.round((subtotal - desc) * 100) / 100,
      };
    })
  );

  // Avanzar el correlativo del emisor
  await supabase
    .from('cfe_emisor_config')
    .update({ [campo]: numero + 1, updated_at: new Date().toISOString() })
    .eq('id', (emisor as any).id);

  await registrarAuditoria(
    'cfe_uy',
    'CREAR_BORRADOR',
    `${nuevo.tipoCFE}-${emisor.serie_actual}-${numero}`,
    null,
    { tipo: nuevo.tipoCFE, total: totales.total, lineas: nuevo.lineas.length },
    nuevo.emitidoPor
  );

  return cfe as CFE;
}

// =====================================================
// FIRMA (skeleton — la real se hace server-side con cert)
// =====================================================

/**
 * Marca el CFE como firmado, calcula un hash determinista
 * y arma el QR. La firma criptográfica real con el
 * certificado del emisor se hace en el endpoint
 * /api/cfe/firmar (por hacer cuando tengas el cert).
 */
export async function firmarCFE(cfeId: string, usuario: string): Promise<boolean> {
  const { data: cfe } = await supabase
    .from('cfe_uy').select('*').eq('id', cfeId).maybeSingle();
  if (!cfe || cfe.estado !== 'borrador') return false;

  // Hash determinista (simplificado — la firma real va con cert RSA)
  const hash = await sha256(`${cfe.tipo_cfe}|${cfe.serie}|${cfe.numero}|${cfe.monto_total}|${cfe.created_at}`);

  // QR según especificación DGI: URL con datos del CFE
  // Formato: https://www.efactura.dgi.gub.uy/consultaQR/?...
  const qr = construirQR(cfe);

  await supabase.from('cfe_uy').update({
    estado: 'firmado',
    hash_xml: hash,
    qr_url: qr,
    fecha_emision: new Date().toISOString(),
  }).eq('id', cfeId);

  await registrarAuditoria(
    'cfe_uy', 'FIRMAR',
    `${cfe.tipo_cfe}-${cfe.serie}-${cfe.numero}`,
    { estado: cfe.estado },
    { estado: 'firmado', hash },
    usuario
  );

  return true;
}

/**
 * Marca como aceptado por DGI y registra el CAE. Usar
 * cuando el web service de DGI devuelve OK.
 */
export async function registrarAceptacionDGI(
  cfeId: string,
  cae: string,
  caeVencimiento: string,
  usuario: string
): Promise<boolean> {
  const { error } = await supabase.from('cfe_uy').update({
    estado: 'aceptado_dgi',
    cae,
    cae_vencimiento: caeVencimiento,
    fecha_respuesta_dgi: new Date().toISOString(),
  }).eq('id', cfeId);
  if (error) return false;

  await registrarAuditoria('cfe_uy', 'ACEPTACION_DGI', cae, null, { cae, vencimiento: caeVencimiento }, usuario);
  return true;
}

export async function registrarRechazoDGI(
  cfeId: string,
  motivo: string,
  usuario: string
): Promise<boolean> {
  const { error } = await supabase.from('cfe_uy').update({
    estado: 'rechazado_dgi',
    rechazo_motivo: motivo,
    fecha_respuesta_dgi: new Date().toISOString(),
  }).eq('id', cfeId);
  if (error) return false;

  await registrarAuditoria('cfe_uy', 'RECHAZO_DGI', cfeId, null, { motivo }, usuario);
  return true;
}

// =====================================================
// HELPERS
// =====================================================

async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback simple para builds que no tengan crypto.subtle
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function construirQR(cfe: any): string {
  // Estructura mínima que DGI espera (consulta pública).
  // El QR completo incluye RUT emisor, tipo, serie, número,
  // fecha, total, hash. Cuando se firme con cert real, el
  // backend reemplaza esta URL con la oficial.
  const params = new URLSearchParams({
    tipo: String(cfe.tipo_cfe),
    serie: cfe.serie,
    numero: String(cfe.numero),
    fecha: (cfe.created_at || '').split('T')[0],
    total: String(cfe.monto_total),
    hash: cfe.hash_xml || '',
  });
  return `https://www.efactura.dgi.gub.uy/consultaQR/?${params.toString()}`;
}
