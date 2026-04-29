// =====================================================
// WMS Picking — algoritmos "AI" (heurísticas inteligentes)
// =====================================================
// Estos helpers viven 100% en TypeScript y no dependen
// de un backend de ML, así que se ejecutan instantáneo
// y sin tener que mantener un servicio separado.
// El "AI" acá es: TSP con 2-opt, clustering geográfico,
// load balancing, FEFO, predicción por regresión simple
// y detección de anomalías por IQR.
// =====================================================

import { supabase } from '@/lib/supabase';

// =====================================================
// 1. Optimización de ruta de picking (TSP)
// =====================================================
// Empieza por nearest-neighbor y mejora con 2-opt swap.
// Para un almacén típico con ≤ 200 paradas converge en
// pocos ms. Resultado: secuencia de líneas con secuencia
// asignada y distancia total estimada.
// =====================================================

export interface PuntoRuta {
  pasillo?: string;
  rack?: string;
  nivel?: string;
  posicion?: string;
  ubicacion_codigo?: string;
}

/** Distancia "manhattan" entre dos posiciones de almacén */
function distanciaUbicaciones(a: PuntoRuta, b: PuntoRuta): number {
  // Convertimos pasillo letra → número (A=1, B=2...)
  const pasilloA = a.pasillo?.charCodeAt(0) || 0;
  const pasilloB = b.pasillo?.charCodeAt(0) || 0;
  // Cambiar de pasillo cuesta más (caminata)
  const dPasillo = Math.abs(pasilloA - pasilloB) * 10;
  const dRack = Math.abs(parseInt(a.rack || '0') - parseInt(b.rack || '0')) * 2;
  const dNivel = Math.abs(parseInt(a.nivel || '0') - parseInt(b.nivel || '0')) * 0.5;
  const dPos = Math.abs(parseInt(a.posicion || '0') - parseInt(b.posicion || '0')) * 0.3;
  // Si solo tenemos código (sin pasillo/rack), comparamos string
  if (!a.pasillo && a.ubicacion_codigo && b.ubicacion_codigo) {
    return Math.abs(a.ubicacion_codigo.localeCompare(b.ubicacion_codigo));
  }
  return dPasillo + dRack + dNivel + dPos;
}

function distanciaTotal<T extends PuntoRuta>(secuencia: T[]): number {
  let d = 0;
  for (let i = 0; i < secuencia.length - 1; i++) {
    d += distanciaUbicaciones(secuencia[i], secuencia[i + 1]);
  }
  return d;
}

/** Nearest-neighbor: arranca por la 1ª ubicación y va a la más cercana sin visitar */
function rutaNearestNeighbor<T extends PuntoRuta>(puntos: T[]): T[] {
  if (puntos.length <= 2) return [...puntos];
  const restantes = [...puntos];
  const ruta: T[] = [restantes.shift()!];
  while (restantes.length) {
    const ultimo = ruta[ruta.length - 1];
    let mejorIdx = 0;
    let mejorD = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = distanciaUbicaciones(ultimo, restantes[i]);
      if (d < mejorD) { mejorD = d; mejorIdx = i; }
    }
    ruta.push(restantes.splice(mejorIdx, 1)[0]);
  }
  return ruta;
}

/** 2-opt: invierte segmentos hasta que no mejore la distancia */
function mejorar2Opt<T extends PuntoRuta>(ruta: T[], maxIter = 200): T[] {
  if (ruta.length < 4) return ruta;
  let r = [...ruta];
  let mejor = distanciaTotal(r);
  let iter = 0;
  let improved = true;
  while (improved && iter < maxIter) {
    improved = false;
    iter++;
    for (let i = 1; i < r.length - 2; i++) {
      for (let j = i + 1; j < r.length - 1; j++) {
        const nueva = [
          ...r.slice(0, i),
          ...r.slice(i, j + 1).reverse(),
          ...r.slice(j + 1),
        ];
        const d = distanciaTotal(nueva);
        if (d < mejor) {
          r = nueva;
          mejor = d;
          improved = true;
        }
      }
    }
  }
  return r;
}

/** Optimiza la ruta y devuelve la secuencia + distancia estimada */
export function optimizarRutaPicking<T extends PuntoRuta>(
  puntos: T[]
): { ruta: T[]; distancia: number; ahorroPct: number } {
  if (puntos.length <= 1) return { ruta: puntos, distancia: 0, ahorroPct: 0 };
  const distOriginal = distanciaTotal(puntos);
  const r1 = rutaNearestNeighbor(puntos);
  const r2 = mejorar2Opt(r1);
  const distFinal = distanciaTotal(r2);
  const ahorroPct = distOriginal > 0 ? Math.max(0, ((distOriginal - distFinal) / distOriginal) * 100) : 0;
  return { ruta: r2, distancia: distFinal, ahorroPct };
}

// =====================================================
// 2. Sugerir waves automáticas
// =====================================================
// Agrupa órdenes pendientes según:
//   - urgencia (fecha_requerida ≤ hoy + N días)
//   - clúster geográfico (ubicaciones cercanas)
//   - productos compartidos (batch picking)
// Devuelve hasta `maxWaves` propuestas.
// =====================================================

export interface OrdenParaWave {
  id: string;
  numero: string;
  cliente_nombre?: string;
  fecha_requerida?: string;
  prioridad?: number;
  unidades_totales?: number;
  lineas_totales?: number;
  productos?: string[];
  ubicaciones?: string[];
}

export interface WaveSugerida {
  id: string;
  motivo: 'urgencia' | 'cluster_geografico' | 'batch_producto' | 'cluster_cliente';
  titulo: string;
  descripcion: string;
  ordenesIds: string[];
  ordenes: OrdenParaWave[];
  unidadesTotales: number;
  prioridad: number;
}

export function sugerirWaves(
  ordenes: OrdenParaWave[],
  hoy: Date = new Date(),
  maxOrdenesPorWave: number = 12
): WaveSugerida[] {
  const sugerencias: WaveSugerida[] = [];
  const idsUsados = new Set<string>();

  // 1. Wave de urgencia: vencen hoy o atrasadas
  const urgentes = ordenes.filter(o => {
    if (!o.fecha_requerida) return false;
    const f = new Date(o.fecha_requerida);
    return f <= hoy;
  }).sort((a, b) => new Date(a.fecha_requerida!).getTime() - new Date(b.fecha_requerida!).getTime());

  if (urgentes.length > 0) {
    const grupo = urgentes.slice(0, maxOrdenesPorWave);
    grupo.forEach(o => idsUsados.add(o.id));
    sugerencias.push({
      id: 'sug-urgencia',
      motivo: 'urgencia',
      titulo: 'Wave urgente — entregas para hoy',
      descripcion: `${grupo.length} orden(es) con entrega vencida o para hoy`,
      ordenesIds: grupo.map(o => o.id),
      ordenes: grupo,
      unidadesTotales: grupo.reduce((s, o) => s + (o.unidades_totales || 0), 0),
      prioridad: 1,
    });
  }

  // 2. Batch por producto: órdenes que comparten muchos productos
  const restantes = ordenes.filter(o => !idsUsados.has(o.id));
  const indexProductos: Record<string, string[]> = {};
  restantes.forEach(o => {
    (o.productos || []).forEach(p => {
      if (!indexProductos[p]) indexProductos[p] = [];
      indexProductos[p].push(o.id);
    });
  });
  const productosCompartidos = Object.entries(indexProductos)
    .filter(([, ids]) => ids.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  productosCompartidos.forEach(([prod, ids]) => {
    const ordenesGrupo = restantes.filter(o => ids.includes(o.id) && !idsUsados.has(o.id)).slice(0, maxOrdenesPorWave);
    if (ordenesGrupo.length < 3) return;
    ordenesGrupo.forEach(o => idsUsados.add(o.id));
    sugerencias.push({
      id: `sug-batch-${prod}`,
      motivo: 'batch_producto',
      titulo: `Batch — producto ${prod}`,
      descripcion: `${ordenesGrupo.length} órdenes que comparten ${prod}. Ideal para picking en batch.`,
      ordenesIds: ordenesGrupo.map(o => o.id),
      ordenes: ordenesGrupo,
      unidadesTotales: ordenesGrupo.reduce((s, o) => s + (o.unidades_totales || 0), 0),
      prioridad: 2,
    });
  });

  // 3. Cluster por mismo cliente
  const restantes2 = ordenes.filter(o => !idsUsados.has(o.id));
  const porCliente: Record<string, OrdenParaWave[]> = {};
  restantes2.forEach(o => {
    if (!o.cliente_nombre) return;
    if (!porCliente[o.cliente_nombre]) porCliente[o.cliente_nombre] = [];
    porCliente[o.cliente_nombre].push(o);
  });
  Object.entries(porCliente)
    .filter(([, lista]) => lista.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2)
    .forEach(([cliente, lista]) => {
      const grupo = lista.slice(0, maxOrdenesPorWave);
      grupo.forEach(o => idsUsados.add(o.id));
      sugerencias.push({
        id: `sug-cliente-${cliente}`,
        motivo: 'cluster_cliente',
        titulo: `Consolidación — ${cliente}`,
        descripcion: `${grupo.length} órdenes del mismo cliente. Conviene preparar juntas para envío único.`,
        ordenesIds: grupo.map(o => o.id),
        ordenes: grupo,
        unidadesTotales: grupo.reduce((s, o) => s + (o.unidades_totales || 0), 0),
        prioridad: 3,
      });
    });

  return sugerencias;
}

// =====================================================
// 3. Predicción de tiempo de picking
// =====================================================
// Modelo simple por regresión empírica:
//   tiempo = base + lineas * tFila + unidades * tUnidad
// Con calibración por histórico real si está disponible.
// =====================================================

export interface PrediccionTiempo {
  minutosEstimados: number;
  minutosOptimo: number;
  minutosAlerta: number;
  detalle: string;
}

const TIEMPO_BASE_MIN = 2;
const TIEMPO_POR_LINEA_MIN = 0.6;
const TIEMPO_POR_UNIDAD_MIN = 0.05;

export function predecirTiempoPicking(
  lineas: number,
  unidades: number,
  factorPicker: number = 1.0
): PrediccionTiempo {
  const base = TIEMPO_BASE_MIN + lineas * TIEMPO_POR_LINEA_MIN + unidades * TIEMPO_POR_UNIDAD_MIN;
  const minutosEstimados = Math.round(base * factorPicker);
  return {
    minutosEstimados,
    minutosOptimo: Math.round(minutosEstimados * 0.8),
    minutosAlerta: Math.round(minutosEstimados * 1.4),
    detalle: `${lineas} líneas · ${unidades} uds`,
  };
}

// =====================================================
// 4. Asignación inteligente de picker
// =====================================================
// Balancea carga entre los pickers disponibles. El picker
// con menos unidades en su pila activa es elegido. Si hay
// empate, se prioriza al que tiene mayor productividad
// histórica.
// =====================================================

export interface PickerInfo {
  email: string;
  nombre?: string;
  productividadFactor?: number; // 1.0 = promedio, <1 = más rápido
  cargaActualUnidades?: number;
}

export function asignarPickerOptimo(
  pickers: PickerInfo[]
): PickerInfo | null {
  if (pickers.length === 0) return null;
  return [...pickers]
    .sort((a, b) => {
      const cargaDiff = (a.cargaActualUnidades || 0) - (b.cargaActualUnidades || 0);
      if (cargaDiff !== 0) return cargaDiff;
      return (a.productividadFactor || 1) - (b.productividadFactor || 1);
    })[0];
}

// =====================================================
// 5. Detección de anomalías en picking
// =====================================================
// Detecta:
//  - Pickers cuyo tiempo promedio está fuera del IQR
//    (desempeño anormalmente lento)
//  - Productos con tasa de short-pick > 15%
//  - Órdenes que llevan abiertas > 6 horas
// =====================================================

export interface Anomalia {
  tipo: 'picker_lento' | 'producto_problematico' | 'orden_estancada';
  severidad: 'info' | 'warning' | 'error';
  titulo: string;
  descripcion: string;
  entidad?: string;
}

export interface OrdenCompletadaResumen {
  picker_email?: string;
  fecha_inicio?: string;
  fecha_completada?: string;
  unidades_pickeadas: number;
  lineas_completadas: number;
}

export interface LineaPickingResumen {
  producto_codigo: string;
  cantidad_solicitada: number;
  cantidad_pickeada: number;
}

export interface OrdenAbiertaResumen {
  numero: string;
  fecha_inicio?: string;
  picker_asignado?: string;
}

function iqrLimits(values: number[]): { low: number; high: number } {
  if (values.length < 4) return { low: -Infinity, high: Infinity };
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

export function detectarAnomaliasPicking(
  completadas: OrdenCompletadaResumen[],
  lineas: LineaPickingResumen[],
  abiertas: OrdenAbiertaResumen[]
): Anomalia[] {
  const anomalias: Anomalia[] = [];

  // 1. Picker lento: minutos/unidad por picker
  const tiemposPicker: Record<string, number[]> = {};
  for (const o of completadas) {
    if (!o.picker_email || !o.fecha_inicio || !o.fecha_completada || o.unidades_pickeadas <= 0) continue;
    const min = (new Date(o.fecha_completada).getTime() - new Date(o.fecha_inicio).getTime()) / 60000;
    const minPorUnidad = min / o.unidades_pickeadas;
    if (!tiemposPicker[o.picker_email]) tiemposPicker[o.picker_email] = [];
    tiemposPicker[o.picker_email].push(minPorUnidad);
  }
  const promedioPorPicker = Object.entries(tiemposPicker).map(([email, arr]) => ({
    email,
    promedio: arr.reduce((s, n) => s + n, 0) / arr.length,
    n: arr.length,
  }));
  if (promedioPorPicker.length >= 3) {
    const { high } = iqrLimits(promedioPorPicker.map(p => p.promedio));
    promedioPorPicker
      .filter(p => p.n >= 3 && p.promedio > high)
      .forEach(p => {
        anomalias.push({
          tipo: 'picker_lento',
          severidad: 'warning',
          titulo: 'Picker con productividad baja',
          descripcion: `${p.email} promedia ${p.promedio.toFixed(2)} min/unidad (IQR alto = ${high.toFixed(2)})`,
          entidad: p.email,
        });
      });
  }

  // 2. Producto problemático: tasa short-pick > 15%
  const stats: Record<string, { sol: number; pick: number }> = {};
  for (const l of lineas) {
    if (!stats[l.producto_codigo]) stats[l.producto_codigo] = { sol: 0, pick: 0 };
    stats[l.producto_codigo].sol += l.cantidad_solicitada;
    stats[l.producto_codigo].pick += l.cantidad_pickeada;
  }
  Object.entries(stats).forEach(([codigo, s]) => {
    if (s.sol < 20) return;
    const tasaShort = (s.sol - s.pick) / s.sol;
    if (tasaShort > 0.15) {
      anomalias.push({
        tipo: 'producto_problematico',
        severidad: 'warning',
        titulo: 'Producto con short-pick frecuente',
        descripcion: `${codigo} tiene ${(tasaShort * 100).toFixed(1)}% de short-pick`,
        entidad: codigo,
      });
    }
  });

  // 3. Órdenes estancadas (abiertas hace más de 6hs)
  const haceSeisHs = Date.now() - 6 * 3600 * 1000;
  abiertas
    .filter(o => o.fecha_inicio && new Date(o.fecha_inicio).getTime() < haceSeisHs)
    .forEach(o => {
      const horas = Math.round((Date.now() - new Date(o.fecha_inicio!).getTime()) / 3600000);
      anomalias.push({
        tipo: 'orden_estancada',
        severidad: 'error',
        titulo: 'Orden de picking estancada',
        descripcion: `${o.numero} lleva ${horas}h en proceso · picker: ${o.picker_asignado || 'sin asignar'}`,
        entidad: o.numero,
      });
    });

  return anomalias;
}

// =====================================================
// 6. FEFO — sugerir lote a pickear
// =====================================================
// Cuando hay varios lotes para el mismo producto, sugerir
// el que vence antes (con stock disponible).
// =====================================================

export interface LoteDisponible {
  lote_id?: string;
  lote_numero?: string;
  fecha_vencimiento?: string;
  cantidad_disponible: number;
  ubicacion_codigo?: string;
}

export function sugerirLoteFefo(lotes: LoteDisponible[]): LoteDisponible | null {
  const disponibles = lotes.filter(l => l.cantidad_disponible > 0);
  if (disponibles.length === 0) return null;
  // Lotes con vencimiento priman sobre los sin vencimiento.
  const conVcto = disponibles.filter(l => l.fecha_vencimiento);
  if (conVcto.length > 0) {
    return [...conVcto].sort((a, b) =>
      new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime()
    )[0];
  }
  return disponibles[0];
}

// =====================================================
// 7. Carga actual por picker (para load-balancing)
// =====================================================

export async function cargarMetricasPickers(): Promise<PickerInfo[]> {
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('email, nombre')
    .eq('activo', true)
    .or('rol.eq.bodeguero,rol.eq.operador,rol.eq.admin');
  if (!usuarios) return [];

  const { data: ordenesActivas } = await supabase
    .from('wms_ordenes_picking')
    .select('picker_asignado, unidades_totales, unidades_pickeadas')
    .in('estado', ['asignada', 'en_proceso']);

  const cargaPorEmail: Record<string, number> = {};
  (ordenesActivas || []).forEach((o: any) => {
    if (!o.picker_asignado) return;
    const restantes = (parseInt(o.unidades_totales) || 0) - (parseInt(o.unidades_pickeadas) || 0);
    cargaPorEmail[o.picker_asignado] = (cargaPorEmail[o.picker_asignado] || 0) + Math.max(0, restantes);
  });

  // Productividad histórica: opcional, traer últimas órdenes
  // completadas y calcular min/unidad. Por defecto factor 1.
  const { data: ordenesHistoricas } = await supabase
    .from('wms_ordenes_picking')
    .select('picker_asignado, fecha_inicio, fecha_completada, unidades_pickeadas')
    .eq('estado', 'completada')
    .not('picker_asignado', 'is', null)
    .gte('fecha_completada', new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(500);

  const tiemposPickerMap: Record<string, number[]> = {};
  (ordenesHistoricas || []).forEach((o: any) => {
    if (!o.picker_asignado || !o.fecha_inicio || !o.fecha_completada) return;
    const min = (new Date(o.fecha_completada).getTime() - new Date(o.fecha_inicio).getTime()) / 60000;
    if (min <= 0 || !o.unidades_pickeadas) return;
    const ratio = min / o.unidades_pickeadas;
    if (!tiemposPickerMap[o.picker_asignado]) tiemposPickerMap[o.picker_asignado] = [];
    tiemposPickerMap[o.picker_asignado].push(ratio);
  });
  const promedioPorPicker: Record<string, number> = {};
  Object.entries(tiemposPickerMap).forEach(([email, arr]) => {
    promedioPorPicker[email] = arr.reduce((s, n) => s + n, 0) / arr.length;
  });
  const promedioGlobal = Object.values(promedioPorPicker).length > 0
    ? Object.values(promedioPorPicker).reduce((s, n) => s + n, 0) / Object.values(promedioPorPicker).length
    : 1;

  return usuarios.map((u: any) => ({
    email: u.email,
    nombre: u.nombre,
    cargaActualUnidades: cargaPorEmail[u.email] || 0,
    productividadFactor: promedioGlobal > 0 && promedioPorPicker[u.email]
      ? promedioPorPicker[u.email] / promedioGlobal
      : 1,
  }));
}
