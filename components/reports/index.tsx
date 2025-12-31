import React, { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  Loader2,
  BarChart3,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product, Movement } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================
// KPI CARD
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'cyan' | 'amber' | 'red' | 'purple';
}

export function KPICard({ title, value, subtitle, trend, trendValue, icon, color }: KPICardProps) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
  };

  return (
    <div className={cn(
      'p-4 rounded-2xl bg-gradient-to-br border',
      colorClasses[color]
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="opacity-80">{icon}</span>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
            trend === 'down' ? 'bg-red-500/20 text-red-400' :
            'bg-slate-500/20 text-slate-400'
          )}>
            {trend === 'up' ? <TrendingUp size={12} /> : 
             trend === 'down' ? <TrendingDown size={12} /> : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-70">{title}</div>
      {subtitle && <div className="text-xs opacity-50 mt-1">{subtitle}</div>}
    </div>
  );
}

// ============================================
// EXECUTIVE DASHBOARD
// ============================================

interface ExecutiveDashboardProps {
  products: Product[];
  movements: Movement[];
}

export function ExecutiveDashboard({ products, movements }: ExecutiveDashboardProps) {
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Calcular KPIs
  const kpis = React.useMemo(() => {
    const now = new Date();
    const thisMonth = movements.filter(m => {
      const date = new Date(m.timestamp);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const lastMonth = movements.filter(m => {
      const date = new Date(m.timestamp);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
    });

    // Valor total del inventario
    const valorTotal = products.reduce((sum, p) => sum + (p.precio * p.stock), 0);
    
    // Total de items
    const totalItems = products.reduce((sum, p) => sum + p.stock, 0);
    
    // Productos con stock bajo
    const stockBajo = products.filter(p => p.stock <= p.stockMinimo).length;
    
    // Productos sin stock
    const sinStock = products.filter(p => p.stock === 0).length;
    
    // Movimientos del mes
    const entradasMes = thisMonth.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + m.cantidad, 0);
    const salidasMes = thisMonth.filter(m => m.tipo === 'salida').reduce((sum, m) => sum + m.cantidad, 0);
    
    // Comparación con mes anterior
    const entradasMesAnterior = lastMonth.filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + m.cantidad, 0);
    const salidasMesAnterior = lastMonth.filter(m => m.tipo === 'salida').reduce((sum, m) => sum + m.cantidad, 0);
    
    const trendEntradas = entradasMesAnterior > 0 
      ? ((entradasMes - entradasMesAnterior) / entradasMesAnterior * 100).toFixed(1)
      : '0';
    const trendSalidas = salidasMesAnterior > 0 
      ? ((salidasMes - salidasMesAnterior) / salidasMesAnterior * 100).toFixed(1)
      : '0';

    // Rotación de inventario
    const rotacion = valorTotal > 0 ? (salidasMes / totalItems * 30).toFixed(1) : '0';

    // Top productos más movidos
    const productMovements: Record<string, number> = {};
    thisMonth.filter(m => m.tipo === 'salida').forEach(m => {
      productMovements[m.codigo] = (productMovements[m.codigo] || 0) + m.cantidad;
    });
    const topProductos = Object.entries(productMovements)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([codigo, cantidad]) => ({
        codigo,
        descripcion: products.find(p => p.codigo === codigo)?.descripcion || codigo,
        cantidad
      }));

    // Distribución por categoría
    const categorias: Record<string, { valor: number; items: number }> = {};
    products.forEach(p => {
      if (!categorias[p.categoria]) {
        categorias[p.categoria] = { valor: 0, items: 0 };
      }
      categorias[p.categoria].valor += p.precio * p.stock;
      categorias[p.categoria].items += p.stock;
    });

    return {
      valorTotal,
      totalItems,
      stockBajo,
      sinStock,
      entradasMes,
      salidasMes,
      trendEntradas: parseFloat(trendEntradas),
      trendSalidas: parseFloat(trendSalidas),
      rotacion,
      topProductos,
      categorias,
      totalProductos: products.length
    };
  }, [products, movements]);

  // Generar PDF
  const generatePDF = async () => {
    setGeneratingPDF(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('VANGUARD', 20, 25);
      
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Reporte Ejecutivo de Inventario', 20, 33);
      
      doc.setTextColor(100, 116, 139);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-UY')} ${new Date().toLocaleTimeString('es-UY')}`, pageWidth - 20, 25, { align: 'right' });

      // KPIs principales
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen Ejecutivo', 20, 55);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      
      const kpiData = [
        ['Valor Total Inventario', `$${kpis.valorTotal.toLocaleString('es-UY', { minimumFractionDigits: 2 })}`],
        ['Total Items en Stock', kpis.totalItems.toLocaleString()],
        ['Total Productos', kpis.totalProductos.toString()],
        ['Productos Stock Bajo', kpis.stockBajo.toString()],
        ['Productos Sin Stock', kpis.sinStock.toString()],
        ['Entradas del Mes', kpis.entradasMes.toLocaleString()],
        ['Salidas del Mes', kpis.salidasMes.toLocaleString()],
        ['Índice Rotación', `${kpis.rotacion} días`],
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Indicador', 'Valor']],
        body: kpiData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' }
        }
      });

      // Top productos
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Top 5 Productos Más Vendidos (Este Mes)', 20, currentY);

      if (kpis.topProductos.length > 0) {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Código', 'Descripción', 'Cantidad']],
          body: kpis.topProductos.map(p => [p.codigo, p.descripcion, p.cantidad.toString()]),
          theme: 'striped',
          headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255] },
          styles: { fontSize: 9 },
          columnStyles: {
            2: { halign: 'right' }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      } else {
        currentY += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('No hay datos de ventas este mes', 20, currentY);
        currentY += 15;
      }

      // Distribución por categoría
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Distribución por Categoría', 20, currentY);

      const categoriaData = Object.entries(kpis.categorias).map(([cat, data]) => [
        cat,
        data.items.toLocaleString(),
        `$${data.valor.toLocaleString('es-UY', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Categoría', 'Items', 'Valor']],
        body: categoriaData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' }
        }
      });

      // Productos con stock bajo
      currentY = (doc as any).lastAutoTable.finalY + 15;
      
      const stockBajoProducts = products
        .filter(p => p.stock <= p.stockMinimo && p.stock > 0)
        .slice(0, 10);

      if (stockBajoProducts.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Productos con Stock Bajo (Requieren Atención)', 20, currentY);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Código', 'Descripción', 'Stock', 'Mínimo']],
          body: stockBajoProducts.map(p => [
            p.codigo, 
            p.descripcion, 
            p.stock.toString(), 
            p.stockMinimo.toString()
          ]),
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] },
          styles: { fontSize: 9 },
          columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' }
          }
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${pageCount} | Vanguard - Sistema de Gestión de Inventario`,
          pageWidth / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Descargar
      doc.save(`reporte-inventario-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con botón de descarga */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="text-emerald-400" />
            Dashboard Ejecutivo
          </h2>
          <p className="text-sm text-slate-500">Resumen de KPIs e indicadores clave</p>
        </div>
        <Button onClick={generatePDF} disabled={generatingPDF}>
          {generatingPDF ? (
            <Loader2 size={18} className="animate-spin mr-2" />
          ) : (
            <Download size={18} className="mr-2" />
          )}
          Descargar PDF
        </Button>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Valor del Inventario"
          value={`$${kpis.valorTotal.toLocaleString('es-UY', { minimumFractionDigits: 0 })}`}
          icon={<DollarSign size={24} />}
          color="emerald"
        />
        <KPICard
          title="Items en Stock"
          value={kpis.totalItems.toLocaleString()}
          subtitle={`${kpis.totalProductos} productos`}
          icon={<Package size={24} />}
          color="cyan"
        />
        <KPICard
          title="Entradas del Mes"
          value={kpis.entradasMes.toLocaleString()}
          trend={kpis.trendEntradas > 0 ? 'up' : kpis.trendEntradas < 0 ? 'down' : 'neutral'}
          trendValue={`${kpis.trendEntradas > 0 ? '+' : ''}${kpis.trendEntradas}%`}
          icon={<TrendingUp size={24} />}
          color="purple"
        />
        <KPICard
          title="Salidas del Mes"
          value={kpis.salidasMes.toLocaleString()}
          trend={kpis.trendSalidas > 0 ? 'up' : kpis.trendSalidas < 0 ? 'down' : 'neutral'}
          trendValue={`${kpis.trendSalidas > 0 ? '+' : ''}${kpis.trendSalidas}%`}
          icon={<TrendingDown size={24} />}
          color="amber"
        />
      </div>

      {/* Segunda fila de KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Productos Stock Bajo"
          value={kpis.stockBajo}
          subtitle="Requieren atención"
          icon={<AlertTriangle size={24} />}
          color={kpis.stockBajo > 0 ? 'amber' : 'emerald'}
        />
        <KPICard
          title="Productos Sin Stock"
          value={kpis.sinStock}
          subtitle="Agotados"
          icon={<Package size={24} />}
          color={kpis.sinStock > 0 ? 'red' : 'emerald'}
        />
        <KPICard
          title="Rotación Inventario"
          value={`${kpis.rotacion} días`}
          subtitle="Promedio de reposición"
          icon={<Calendar size={24} />}
          color="cyan"
        />
      </div>

      {/* Top productos y categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top productos */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-cyan-400" />
            Top 5 Productos Más Vendidos
          </h3>
          {kpis.topProductos.length > 0 ? (
            <div className="space-y-2">
              {kpis.topProductos.map((p, i) => (
                <div key={p.codigo} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      i === 0 ? 'bg-amber-500 text-slate-900' :
                      i === 1 ? 'bg-slate-400 text-slate-900' :
                      i === 2 ? 'bg-amber-700 text-white' :
                      'bg-slate-700 text-slate-300'
                    )}>
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{p.codigo}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{p.descripcion}</div>
                    </div>
                  </div>
                  <span className="font-mono text-cyan-400 font-semibold">{p.cantidad}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500">
              No hay datos de ventas este mes
            </div>
          )}
        </Card>

        {/* Distribución por categoría */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-purple-400" />
            Distribución por Categoría
          </h3>
          <div className="space-y-2">
            {Object.entries(kpis.categorias).map(([cat, data]) => {
              const percentage = kpis.valorTotal > 0 ? (data.valor / kpis.valorTotal * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{cat}</span>
                    <span className="text-slate-400">{data.items} items</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    ${data.valor.toLocaleString('es-UY', { minimumFractionDigits: 0 })} ({percentage.toFixed(1)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}