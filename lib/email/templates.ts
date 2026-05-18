// =====================================================
// Templates de email — HTML + texto plano
// =====================================================
// Cada template devuelve { subject, html, text } listos
// para pasar a enviarEmail().
// =====================================================

export interface OCEmailData {
  numero: string;
  proveedorNombre: string;
  fechaCreacion: string;
  fechaEsperada?: string | null;
  creadoPor: string;
  total: number;
  moneda?: string;
  items: { codigo: string; descripcion?: string; cantidad: number; costoUnitario: number }[];
  notas?: string | null;
  /** URL absoluta donde el destinatario puede ver la OC en el sistema */
  linkOC?: string;
}

function formatMoney(n: number, moneda = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: moneda }).format(n);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================
// INTERNO — notificación a equipo de compras / gerencia
// =====================================================
export function templateOCInterno(data: OCEmailData): { subject: string; html: string; text: string } {
  const subject = `[Vanguard] Nueva orden de compra ${data.numero} — ${data.proveedorNombre}`;

  const itemsHtml = data.items
    .map(
      it => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#64748b;">${escapeHtml(it.codigo)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.descripcion || '')}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${it.cantidad}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.costoUnitario, data.moneda)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatMoney(it.cantidad * it.costoUnitario, data.moneda)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:24px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#0f172a;padding:24px;color:white;">
      <div style="font-size:12px;letter-spacing:0.2em;color:#94a3b8;text-transform:uppercase;">Vanguard ERP</div>
      <h1 style="margin:8px 0 0;font-size:20px;font-weight:600;">Nueva orden de compra</h1>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#475569;">
        Se creó una nueva orden de compra en el sistema. Detalle abajo.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Número</td><td style="padding:8px 12px;font-weight:600;">${escapeHtml(data.numero)}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Proveedor</td><td style="padding:8px 12px;font-weight:600;">${escapeHtml(data.proveedorNombre)}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Creada por</td><td style="padding:8px 12px;">${escapeHtml(data.creadoPor)}</td></tr>
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Fecha creación</td><td style="padding:8px 12px;">${escapeHtml(data.fechaCreacion)}</td></tr>
        ${data.fechaEsperada ? `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Fecha esperada</td><td style="padding:8px 12px;">${escapeHtml(data.fechaEsperada)}</td></tr>` : ''}
        <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Total</td><td style="padding:8px 12px;font-weight:600;font-size:16px;color:#0f172a;">${formatMoney(data.total, data.moneda)}</td></tr>
      </table>

      <h3 style="font-size:14px;color:#0f172a;margin:24px 0 8px;">Items (${data.items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;color:#64748b;font-weight:500;">Código</th>
            <th style="padding:8px;color:#64748b;font-weight:500;">Descripción</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Cantidad</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Costo unit.</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${data.notas ? `<div style="margin-top:24px;padding:12px;background:#fef9c3;border-left:3px solid #ca8a04;border-radius:4px;"><div style="font-size:12px;color:#854d0e;font-weight:600;margin-bottom:4px;">Notas</div><div style="color:#422006;font-size:14px;">${escapeHtml(data.notas)}</div></div>` : ''}

      ${data.linkOC ? `<div style="margin-top:24px;text-align:center;"><a href="${escapeHtml(data.linkOC)}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:500;">Ver en Vanguard →</a></div>` : ''}
    </div>

    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      Email automático generado por Vanguard. No respondas a este mensaje.
    </div>
  </div>
</body></html>`;

  const text = [
    `Nueva orden de compra ${data.numero}`,
    `Proveedor: ${data.proveedorNombre}`,
    `Creada por: ${data.creadoPor}`,
    `Fecha: ${data.fechaCreacion}`,
    data.fechaEsperada ? `Fecha esperada: ${data.fechaEsperada}` : '',
    `Total: ${formatMoney(data.total, data.moneda)}`,
    '',
    `Items (${data.items.length}):`,
    ...data.items.map(it => `  - ${it.codigo}: ${it.cantidad} × ${formatMoney(it.costoUnitario, data.moneda)}`),
    '',
    data.notas ? `Notas: ${data.notas}` : '',
    '',
    data.linkOC ? `Ver en Vanguard: ${data.linkOC}` : '',
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// =====================================================
// PROVEEDOR — envío manual al proveedor de la OC
// =====================================================
export function templateOCProveedor(data: OCEmailData & { nombreEmpresa: string; contactoCompras?: string }): { subject: string; html: string; text: string } {
  const subject = `Orden de compra ${data.numero} — ${data.nombreEmpresa}`;

  const itemsHtml = data.items
    .map(
      it => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#64748b;">${escapeHtml(it.codigo)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.descripcion || '')}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${it.cantidad}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.costoUnitario, data.moneda)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatMoney(it.cantidad * it.costoUnitario, data.moneda)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:24px auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1e3a8a;padding:24px;color:white;">
      <div style="font-size:12px;letter-spacing:0.2em;color:#bfdbfe;text-transform:uppercase;">${escapeHtml(data.nombreEmpresa)}</div>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">Orden de compra ${escapeHtml(data.numero)}</h1>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;">Estimados,</p>
      <p style="margin:0 0 16px;color:#334155;">
        Adjunto la orden de compra ${escapeHtml(data.numero)} de <strong>${escapeHtml(data.nombreEmpresa)}</strong>${data.fechaEsperada ? ` con fecha esperada de entrega <strong>${escapeHtml(data.fechaEsperada)}</strong>` : ''}.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;color:#64748b;font-weight:500;">Código</th>
            <th style="padding:8px;color:#64748b;font-weight:500;">Descripción</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Cantidad</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Costo unit.</th>
            <th style="padding:8px;color:#64748b;font-weight:500;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:12px 8px;text-align:right;font-weight:600;">Total</td><td style="padding:12px 8px;text-align:right;font-weight:700;font-size:16px;">${formatMoney(data.total, data.moneda)}</td></tr>
        </tfoot>
      </table>

      ${data.notas ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-left:3px solid #64748b;border-radius:4px;"><div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px;">Notas adicionales</div><div style="color:#0f172a;font-size:14px;">${escapeHtml(data.notas)}</div></div>` : ''}

      <p style="margin:24px 0 8px;color:#334155;">Por favor confirmá la recepción de esta orden y la fecha estimada de entrega.</p>
      <p style="margin:0;color:#475569;">Saludos,<br/>${escapeHtml(data.contactoCompras || data.creadoPor)}<br/>${escapeHtml(data.nombreEmpresa)}</p>
    </div>
  </div>
</body></html>`;

  const text = [
    `Orden de compra ${data.numero}`,
    `Emisor: ${data.nombreEmpresa}`,
    '',
    `Estimados, adjunto la orden de compra ${data.numero}${data.fechaEsperada ? ` con fecha esperada ${data.fechaEsperada}` : ''}.`,
    '',
    'Items:',
    ...data.items.map(it => `  - ${it.codigo}: ${it.cantidad} × ${formatMoney(it.costoUnitario, data.moneda)} = ${formatMoney(it.cantidad * it.costoUnitario, data.moneda)}`),
    '',
    `Total: ${formatMoney(data.total, data.moneda)}`,
    data.notas ? `\nNotas: ${data.notas}` : '',
    '',
    'Por favor confirmar recepción y fecha de entrega.',
    '',
    `Saludos,\n${data.contactoCompras || data.creadoPor}\n${data.nombreEmpresa}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}
