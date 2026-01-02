import * as XLSX from 'xlsx';
import { Product, Movement } from '@/types';

export function exportProductsToExcel(products: Product[], filename: string = 'productos') {
  const data = products.map(p => ({
    'Código': p.codigo,
    'Descripción': p.descripcion,
    'Categoría': p.categoria,
    'Stock': p.stock,
    'Stock Mínimo': p.stockMinimo,
    'Precio Venta': p.precio,
    'Costo Promedio': p.costoPromedio || 0,
    'Valor en Stock': p.stock * p.precio,
    'Estado': p.stock === 0 ? 'SIN STOCK' : p.stock <= p.stockMinimo ? 'STOCK BAJO' : 'OK'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportMovementsToExcel(movements: Movement[], products: Product[], filename: string = 'movimientos') {
  const productMap = new Map(products.map(p => [p.codigo, p.descripcion]));

  const data = movements.map(m => ({
    'Fecha': new Date(m.timestamp).toLocaleDateString('es-UY'),
    'Hora': new Date(m.timestamp).toLocaleTimeString('es-UY'),
    'Código': m.codigo,
    'Descripción': productMap.get(m.codigo) || m.codigo,
    'Tipo': m.tipo.toUpperCase(),
    'Cantidad': m.cantidad,
    'Costo Compra': m.costoCompra || '-',
    'Usuario': m.usuario,
    'Notas': m.notas || '-'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 40 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 25 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportInventoryReportToExcel(
  products: Product[], 
  movements: Movement[],
  filename: string = 'reporte-inventario'
) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const resumen = [
    ['REPORTE DE INVENTARIO'],
    ['Fecha:', new Date().toLocaleDateString('es-UY')],
    [''],
    ['RESUMEN GENERAL'],
    ['Total Productos:', products.length],
    ['Total Items en Stock:', products.reduce((sum, p) => sum + p.stock, 0)],
    ['Valor Total (Precio Venta):', products.reduce((sum, p) => sum + p.stock * p.precio, 0)],
    ['Valor Total (Costo):', products.reduce((sum, p) => sum + p.stock * (p.costoPromedio || 0), 0)],
    ['Productos con Stock Bajo:', products.filter(p => p.stock <= p.stockMinimo && p.stock > 0).length],
    ['Productos sin Stock:', products.filter(p => p.stock === 0).length],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja 2: Productos
  const productData = products.map(p => ({
    'Código': p.codigo,
    'Descripción': p.descripcion,
    'Categoría': p.categoria,
    'Stock': p.stock,
    'Stock Mínimo': p.stockMinimo,
    'Precio Venta': p.precio,
    'Costo Promedio': p.costoPromedio || 0,
    'Valor Stock (Venta)': p.stock * p.precio,
    'Valor Stock (Costo)': p.stock * (p.costoPromedio || 0),
    'Margen': p.precio - (p.costoPromedio || 0),
    'Estado': p.stock === 0 ? 'SIN STOCK' : p.stock <= p.stockMinimo ? 'STOCK BAJO' : 'OK'
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');

  // Hoja 3: Stock Bajo
  const stockBajo = products
    .filter(p => p.stock <= p.stockMinimo)
    .map(p => ({
      'Código': p.codigo,
      'Descripción': p.descripcion,
      'Stock Actual': p.stock,
      'Stock Mínimo': p.stockMinimo,
      'Faltante': Math.max(0, p.stockMinimo - p.stock),
      'Estado': p.stock === 0 ? 'CRÍTICO' : 'BAJO'
    }));
  const wsStockBajo = XLSX.utils.json_to_sheet(stockBajo);
  XLSX.utils.book_append_sheet(wb, wsStockBajo, 'Stock Bajo');

  // Hoja 4: Movimientos
  const productMap = new Map(products.map(p => [p.codigo, p.descripcion]));
  const movData = movements.slice(0, 100).map(m => ({
    'Fecha': new Date(m.timestamp).toLocaleDateString('es-UY'),
    'Hora': new Date(m.timestamp).toLocaleTimeString('es-UY'),
    'Código': m.codigo,
    'Descripción': productMap.get(m.codigo) || m.codigo,
    'Tipo': m.tipo.toUpperCase(),
    'Cantidad': m.cantidad,
    'Usuario': m.usuario,
  }));
  const wsMovements = XLSX.utils.json_to_sheet(movData);
  XLSX.utils.book_append_sheet(wb, wsMovements, 'Movimientos');

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
}