'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Clock, Target,
  BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  FileText, CheckCircle, Percent, ShoppingCart
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { formatCurrency, cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

interface KPIData {
  dso: number;
  dpo: number;
  ccc: number;
  margenBrutoPct: number;
  margenBruto: number;
  tasaConversionCotizaciones: number;
  cicloVentaDias: number;
  ventasMes: number;
  comprasMes: number;
  cxcTotal: number;
  cxpTotal: number;
}

interface RentabilidadCliente {
  clienteId: string;
  nombre: string;
  ventas: number;
  costo: number;
  margen: number;
  margenPct: number;
  ordenes: number;
}

interface RentabilidadProductoCliente {
  key: string;
  productoCodigo: string;
  productoDescripcion: string;
  clienteId: string;
  clienteNombre: string;
  cantidad: number;
  ventas: number;
  costo: number;
  margen: number;
  margenPct: number;
}

interface TendenciaMes {
  mes: string;
  ventas: number;
  compras: number;
  margenPct: number;
}

interface PipelineStage {
  estado: string;
  label: string;
  cantidad: number;
  valor: number;
  color: string;
}

// ============================================
// HELPERS
// ============================================

function KPICard({
  label, value, sub, trend, icon: Icon, color, alert
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: number; label: string };
  icon: React.ElementType;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 bg-slate-900',
      alert ? 'border-amber-500/40' : 'border-slate-800'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl', `bg-${color}-500/20`)}>
          <Icon className={cn('h-5 w-5', `text-${color}-400`)} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
            trend.value >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          )}>
            {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
        {alert && <AlertCircle className="h-4 w-4 text-amber-400" />}
      </div>
      <div className={cn('text-2xl font-bold mb-1', `text-${color}-400`)}>{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ComercialAnalytics() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [rentabilidad, setRentabilidad] = useState<RentabilidadCliente[]>([]);
  const [pivotPC, setPivotPC] = useState<RentabilidadProductoCliente[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaMes[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'3m' | '6m' | '12m'>('6m');
  const [pivotSort, setPivotSort] = useState<'margen' | 'margenPct' | 'ventas' | 'cantidad'>('margen');

  useEffect(() => {
    loadData();
  }, [periodo]);

  const loadData = async () => {
    setLoading(true);
    try {
      const meses = periodo === '3m' ? 3 : periodo === '6m' ? 6 : 12;
      const desde = new Date();
      desde.setMonth(desde.getMonth() - meses);
      const desdeStr = desde.toISOString().split('T')[0];

      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];

      await Promise.all([
        calcularKPIs(desdeStr, inicioMes),
        calcularRentabilidad(desdeStr),
        calcularPivotProductoCliente(desdeStr),
        calcularTendencia(meses),
        calcularPipeline(),
      ]);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const calcularKPIs = async (desdeStr: string, inicioMes: string) => {
    const [ventasRes, comprasRes, cxcRes, cxpRes, cotizRes, cotizConvRes] = await Promise.all([
      supabase.from('ordenes_venta').select('total').gte('fecha_orden', inicioMes).not('estado', 'eq', 'cancelada'),
      supabase.from('ordenes_compra').select('total').gte('fecha_orden', inicioMes).not('estado', 'eq', 'cancelada'),
      supabase.from('ordenes_venta').select('saldo_pendiente').or('estado_pago.eq.pendiente,estado_pago.eq.parcial').not('estado', 'eq', 'cancelada'),
      supabase.from('ordenes_compra').select('total').not('estado', 'in', '("cancelada","recibida")'),
      supabase.from('cotizaciones').select('id', { count: 'exact', head: true }),
      supabase.from('cotizaciones').select('id', { count: 'exact', head: true }).in('estado', ['convertida', 'aceptada']),
    ]);

    const ventasMes = ventasRes.data?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
    const comprasMes = comprasRes.data?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
    const cxcTotal = cxcRes.data?.reduce((s, o) => s + parseFloat(o.saldo_pendiente || 0), 0) || 0;
    const cxpTotal = cxpRes.data?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;

    const totalCotiz = cotizRes.count || 0;
    const convertidas = cotizConvRes.count || 0;
    const tasaConversion = totalCotiz > 0 ? (convertidas / totalCotiz) * 100 : 0;

    // DSO = (CxC / ventas_mes) * 30
    const dso = ventasMes > 0 ? Math.round((cxcTotal / ventasMes) * 30) : 0;
    // DPO = (CxP / compras_mes) * 30
    const dpo = comprasMes > 0 ? Math.round((cxpTotal / comprasMes) * 30) : 0;
    const ccc = dso - dpo;

    const margenBruto = ventasMes - comprasMes;
    const margenBrutoPct = ventasMes > 0 ? (margenBruto / ventasMes) * 100 : 0;

    // Ciclo de venta: avg days from confirmada to entregada
    const { data: entregadas } = await supabase
      .from('ordenes_venta')
      .select('fecha_orden, fecha_entregada')
      .eq('estado', 'entregada')
      .not('fecha_entregada', 'is', null)
      .gte('fecha_orden', desdeStr)
      .limit(100);

    let cicloVentaDias = 0;
    if (entregadas && entregadas.length > 0) {
      const totalDias = entregadas.reduce((s, o) => {
        const diff = new Date(o.fecha_entregada).getTime() - new Date(o.fecha_orden).getTime();
        return s + Math.max(0, diff / (1000 * 60 * 60 * 24));
      }, 0);
      cicloVentaDias = Math.round(totalDias / entregadas.length);
    }

    setKpis({ dso, dpo, ccc, margenBrutoPct, margenBruto, tasaConversionCotizaciones: tasaConversion, cicloVentaDias, ventasMes, comprasMes, cxcTotal, cxpTotal });
  };

  const calcularRentabilidad = async (desdeStr: string) => {
    const { data: items } = await supabase
      .from('ordenes_venta_items')
      .select(`
        cantidad,
        precio_unitario,
        descuento_item,
        subtotal,
        ordenes_venta!inner(cliente_id, estado, fecha_orden, clientes(nombre)),
        productos!left(costo)
      `)
      .gte('ordenes_venta.fecha_orden', desdeStr)
      .not('ordenes_venta.estado', 'eq', 'cancelada');

    const clienteMap = new Map<string, RentabilidadCliente>();

    items?.forEach((item: any) => {
      const ov = item.ordenes_venta;
      if (!ov?.cliente_id) return;

      const cid = ov.cliente_id;
      const nombre = ov.clientes?.nombre || 'Sin cliente';
      const ingreso = parseFloat(item.subtotal || 0);
      const costoUnit = parseFloat(item.productos?.costo || item.precio_unitario * 0.6);
      const costoItem = costoUnit * parseInt(item.cantidad || 0);

      const existing = clienteMap.get(cid);
      if (existing) {
        existing.ventas += ingreso;
        existing.costo += costoItem;
        existing.ordenes += 0;
      } else {
        clienteMap.set(cid, { clienteId: cid, nombre, ventas: ingreso, costo: costoItem, margen: 0, margenPct: 0, ordenes: 1 });
      }
    });

    // Count distinct orders per client
    const { data: ordenes } = await supabase
      .from('ordenes_venta')
      .select('cliente_id')
      .gte('fecha_orden', desdeStr)
      .not('estado', 'eq', 'cancelada');
    const ordenCount = new Map<string, number>();
    ordenes?.forEach((o: any) => ordenCount.set(o.cliente_id, (ordenCount.get(o.cliente_id) || 0) + 1));

    const result: RentabilidadCliente[] = Array.from(clienteMap.values()).map(c => {
      const margen = c.ventas - c.costo;
      return {
        ...c,
        margen,
        margenPct: c.ventas > 0 ? (margen / c.ventas) * 100 : 0,
        ordenes: ordenCount.get(c.clienteId) || 1,
      };
    }).sort((a, b) => b.margen - a.margen).slice(0, 10);

    setRentabilidad(result);
  };

  const calcularPivotProductoCliente = async (desdeStr: string) => {
    const { data: items } = await supabase
      .from('ordenes_venta_items')
      .select(`
        cantidad,
        precio_unitario,
        descuento_item,
        subtotal,
        producto_codigo,
        ordenes_venta!inner(cliente_id, estado, fecha_orden, clientes(nombre)),
        productos!left(codigo, descripcion, costo)
      `)
      .gte('ordenes_venta.fecha_orden', desdeStr)
      .not('ordenes_venta.estado', 'eq', 'cancelada');

    const map = new Map<string, RentabilidadProductoCliente>();

    items?.forEach((item: any) => {
      const ov = item.ordenes_venta;
      if (!ov?.cliente_id) return;

      const cid = ov.cliente_id;
      const cnombre = ov.clientes?.nombre || 'Sin cliente';
      const pcodigo = item.producto_codigo || item.productos?.codigo || 'SIN-CODIGO';
      const pdesc = item.productos?.descripcion || pcodigo;

      const cantidad = parseInt(item.cantidad || 0);
      const ingreso = parseFloat(item.subtotal || 0);
      const costoUnit = parseFloat(item.productos?.costo || item.precio_unitario * 0.6);
      const costoItem = costoUnit * cantidad;

      const key = `${pcodigo}__${cid}`;
      const existing = map.get(key);
      if (existing) {
        existing.cantidad += cantidad;
        existing.ventas += ingreso;
        existing.costo += costoItem;
      } else {
        map.set(key, {
          key,
          productoCodigo: pcodigo,
          productoDescripcion: pdesc,
          clienteId: cid,
          clienteNombre: cnombre,
          cantidad,
          ventas: ingreso,
          costo: costoItem,
          margen: 0,
          margenPct: 0,
        });
      }
    });

    const result = Array.from(map.values()).map(r => {
      const margen = r.ventas - r.costo;
      return {
        ...r,
        margen,
        margenPct: r.ventas > 0 ? (margen / r.ventas) * 100 : 0,
      };
    });

    setPivotPC(result);
  };

  const calcularTendencia = async (meses: number) => {
    const result: TendenciaMes[] = [];
    const hoy = new Date();

    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const inicio = d.toISOString().split('T')[0];
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

      const [vRes, cRes] = await Promise.all([
        supabase.from('ordenes_venta').select('total').gte('fecha_orden', inicio).lte('fecha_orden', fin).not('estado', 'eq', 'cancelada'),
        supabase.from('ordenes_compra').select('total').gte('fecha_orden', inicio).lte('fecha_orden', fin).not('estado', 'eq', 'cancelada'),
      ]);

      const ventas = vRes.data?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
      const compras = cRes.data?.reduce((s, o) => s + parseFloat(o.total || 0), 0) || 0;
      const margenPct = ventas > 0 ? ((ventas - compras) / ventas) * 100 : 0;

      result.push({
        mes: d.toLocaleDateString('es-UY', { month: 'short', year: '2-digit' }),
        ventas,
        compras,
        margenPct: Math.round(margenPct * 10) / 10,
      });
    }

    setTendencia(result);
  };

  const calcularPipeline = async () => {
    const estados = [
      { estado: 'borrador', label: 'Borrador', color: '#64748b' },
      { estado: 'enviada', label: 'Enviadas', color: '#3b82f6' },
      { estado: 'aceptada', label: 'Aceptadas', color: '#10b981' },
      { estado: 'convertida', label: 'Convertidas', color: '#8b5cf6' },
      { estado: 'rechazada', label: 'Rechazadas', color: '#ef4444' },
    ];

    const { data } = await supabase.from('cotizaciones').select('estado, total');

    const stages: PipelineStage[] = estados.map(e => {
      const items = data?.filter(c => c.estado === e.estado) || [];
      return {
        ...e,
        cantidad: items.length,
        valor: items.reduce((s, c) => s + parseFloat(c.total || 0), 0),
      };
    });

    setPipeline(stages);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const dsoColor = !kpis ? 'slate' : kpis.dso > 60 ? 'red' : kpis.dso > 30 ? 'amber' : 'emerald';
  const dpoColor = !kpis ? 'slate' : kpis.dpo > 45 ? 'emerald' : kpis.dpo > 20 ? 'amber' : 'red';
  const cccColor = !kpis ? 'slate' : kpis.ccc < 0 ? 'emerald' : kpis.ccc < 30 ? 'amber' : 'red';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-400" />
            Inteligencia Comercial
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">KPIs financieros, rentabilidad y pipeline de ventas</p>
        </div>
        <div className="flex items-center gap-2">
          {(['3m', '6m', '12m'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                periodo === p ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {p}
            </button>
          ))}
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPIs Financieros */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">KPIs de Liquidez Comercial</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="DSO — Días de Cobro"
            value={`${kpis?.dso || 0}d`}
            sub={`CxC: ${formatCurrency(kpis?.cxcTotal || 0)}`}
            icon={Clock}
            color={dsoColor}
            alert={(kpis?.dso || 0) > 60}
          />
          <KPICard
            label="DPO — Días de Pago"
            value={`${kpis?.dpo || 0}d`}
            sub={`CxP: ${formatCurrency(kpis?.cxpTotal || 0)}`}
            icon={FileText}
            color={dpoColor}
          />
          <KPICard
            label="CCC — Ciclo de Caja"
            value={`${kpis?.ccc !== undefined ? (kpis.ccc >= 0 ? '+' : '') + kpis.ccc : 0}d`}
            sub="DSO − DPO"
            icon={TrendingUp}
            color={cccColor}
            alert={(kpis?.ccc || 0) > 30}
          />
          <KPICard
            label="Ciclo de Venta"
            value={`${kpis?.cicloVentaDias || 0}d`}
            sub="OV confirmada → entregada"
            icon={Target}
            color="purple"
          />
        </div>
      </div>

      {/* KPIs Comerciales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Margen Bruto"
          value={`${(kpis?.margenBrutoPct || 0).toFixed(1)}%`}
          sub={formatCurrency(kpis?.margenBruto || 0)}
          icon={Percent}
          color={(kpis?.margenBrutoPct || 0) >= 20 ? 'emerald' : 'amber'}
        />
        <KPICard
          label="Conversión Cotizaciones"
          value={`${(kpis?.tasaConversionCotizaciones || 0).toFixed(1)}%`}
          sub="Cotiz. aceptadas / total"
          icon={CheckCircle}
          color={(kpis?.tasaConversionCotizaciones || 0) >= 30 ? 'emerald' : 'amber'}
        />
        <KPICard
          label="Ventas del Mes"
          value={formatCurrency(kpis?.ventasMes || 0)}
          icon={TrendingUp}
          color="emerald"
        />
        <KPICard
          label="Compras del Mes"
          value={formatCurrency(kpis?.comprasMes || 0)}
          icon={ShoppingCart}
          color="cyan"
        />
      </div>

      {/* Tendencia + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendencia de margen */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Ventas vs Compras — Tendencia
          </h3>
          {tendencia.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin datos suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={tendencia}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#10b981" fill="url(#gVentas)" strokeWidth={2} />
                <Area type="monotone" dataKey="compras" name="Compras" stroke="#06b6d4" fill="url(#gCompras)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline de cotizaciones */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" />
            Pipeline de Cotizaciones
          </h3>
          {pipeline.every(p => p.cantidad === 0) ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin cotizaciones</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pipeline.filter(p => p.cantidad > 0)} cx="50%" cy="50%" outerRadius={65} dataKey="cantidad" nameKey="label">
                    {pipeline.filter(p => p.cantidad > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                    formatter={(v: number, name: string, props: any) => [
                      `${v} (${formatCurrency(props.payload.valor)})`, props.payload.label
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pipeline.filter(p => p.cantidad > 0).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-400">{s.label}</span>
                    </div>
                    <span className="text-slate-300 font-medium">{s.cantidad} — {formatCurrency(s.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Margen % por mes */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Percent className="h-4 w-4 text-amber-400" />
          Evolución del Margen Bruto (%)
        </h3>
        {tendencia.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                formatter={(v: number) => [`${v}%`, 'Margen']}
              />
              <Bar dataKey="margenPct" name="Margen %" radius={[4, 4, 0, 0]}>
                {tendencia.map((entry, i) => (
                  <Cell key={i} fill={entry.margenPct >= 20 ? '#10b981' : entry.margenPct >= 10 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Rentabilidad por Cliente */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-400" />
          Rentabilidad por Cliente (Top 10)
        </h3>
        {rentabilidad.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-sm">Sin datos del período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium text-right">Ventas</th>
                  <th className="pb-2 font-medium text-right">Costo Est.</th>
                  <th className="pb-2 font-medium text-right">Margen</th>
                  <th className="pb-2 font-medium text-right">Margen %</th>
                  <th className="pb-2 font-medium text-right">Órdenes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rentabilidad.map((r, i) => (
                  <tr key={r.clienteId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 pr-3">
                      <span className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                        i === 0 ? 'bg-amber-500/20 text-amber-400' :
                        i === 1 ? 'bg-slate-500/20 text-slate-400' :
                        i === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-800 text-slate-500'
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-200 font-medium">{r.nombre}</td>
                    <td className="py-2.5 text-right text-emerald-400">{formatCurrency(r.ventas)}</td>
                    <td className="py-2.5 text-right text-slate-400">{formatCurrency(r.costo)}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-200">{formatCurrency(r.margen)}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        r.margenPct >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                        r.margenPct >= 15 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {r.margenPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400">{r.ordenes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rentabilidad Producto × Cliente */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-purple-400" />
            Rentabilidad Producto × Cliente (Top 25)
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 mr-1">Ordenar por:</span>
            {([
              { id: 'margen', label: 'Margen $' },
              { id: 'margenPct', label: 'Margen %' },
              { id: 'ventas', label: 'Ventas' },
              { id: 'cantidad', label: 'Cantidad' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPivotSort(opt.id)}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                  pivotSort === opt.id ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {pivotPC.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-sm">Sin datos del período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium text-right">Cant.</th>
                  <th className="pb-2 font-medium text-right">Ventas</th>
                  <th className="pb-2 font-medium text-right">Costo Est.</th>
                  <th className="pb-2 font-medium text-right">Margen</th>
                  <th className="pb-2 font-medium text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {[...pivotPC]
                  .sort((a, b) => (b[pivotSort] as number) - (a[pivotSort] as number))
                  .slice(0, 25)
                  .map(r => (
                    <tr key={r.key} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="font-mono text-xs text-slate-500">{r.productoCodigo}</div>
                        <div className="text-slate-200">{r.productoDescripcion}</div>
                      </td>
                      <td className="py-2.5 text-slate-300">{r.clienteNombre}</td>
                      <td className="py-2.5 text-right text-slate-400 font-mono">{r.cantidad}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-mono">{formatCurrency(r.ventas)}</td>
                      <td className="py-2.5 text-right text-slate-400 font-mono">{formatCurrency(r.costo)}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-200 font-mono">{formatCurrency(r.margen)}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          r.margenPct >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                          r.margenPct >= 15 ? 'bg-amber-500/20 text-amber-400' :
                          r.margenPct < 0 ? 'bg-red-500/30 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        )}>
                          {r.margenPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500 flex items-center gap-3">
              <span>Mostrando top 25 de {pivotPC.length} combinaciones</span>
              <span className="ml-auto">Costo estimado: producto.costo si existe, sino 60% del precio</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
