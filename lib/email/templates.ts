// =====================================================
// Templates de email — HTML + texto plano
// =====================================================
// Cada template devuelve { subject, html, text } listos
// para pasar a enviarEmail().
//
// Estilo: usa el escudo de Vanguard inline en SVG (igual
// que el PDF) en la esquina superior. Funciona en clientes
// modernos (Gmail, Apple Mail, Outlook web/365). Outlook
// desktop clásico igual cae al texto "VANGUARD" del header.
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

/**
 * Formatea fecha+hora en zona horaria de Uruguay.
 *
 * En servidores Node/Vercel el reloj corre en UTC. Sin pasar `timeZone`,
 * `toLocaleString('es-UY')` muestra hora UTC → llegaban mails con 3h de
 * diferencia. Forzamos explícitamente 'America/Montevideo' para que la
 * hora del mail coincida con la que ve el usuario en la app.
 *
 * Acepta:
 *   - Date
 *   - string ISO ('2026-05-22T14:30:00Z')
 *   - string ya formateado (lo devuelve tal cual; útil para no romper
 *     llamadas legacy que ya pasaban strings pre-formateados).
 */
export function formatFechaHora(input: Date | string | null | undefined): string {
  if (!input) return '';
  if (input instanceof Date) return formatFecha(input);
  // Si es un ISO/parseable lo formateamos; si no, devolvemos tal cual.
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return formatFecha(d);
}

function formatFecha(d: Date): string {
  return new Intl.DateTimeFormat('es-UY', {
    timeZone: 'America/Montevideo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

// =====================================================
// Escudo de Vanguard — PNG hospedado (no SVG)
// =====================================================
// Gmail, Outlook desktop y muchos otros clientes filtran <svg> inline
// por seguridad — el escudo no se veía. Usamos un <img> apuntando al
// PNG público que ya vive en /public/vang.png.
//
// URL base: NEXT_PUBLIC_APP_URL si está seteada (recomendado en Vercel),
// con fallback al dominio de producción para que la imagen igual cargue
// si el env var no se configuró.
const PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://vanguard-beryl.vercel.app').replace(/\/+$/, '');

function escudoVanguardImg(size = 48): string {
  const w = size;
  const h = Math.round(size * 76 / 64);
  return `<img src="${PUBLIC_BASE_URL}/vang.png" width="${w}" height="${h}" alt="Vanguard" style="display:block;border:0;outline:none;text-decoration:none;width:${w}px;height:${h}px;" />`;
}

// =====================================================
// Header reutilizable — escudo a la izquierda, título a la derecha
// =====================================================
function header(opts: {
  fondo: string;        // color de fondo del header (ej: '#0f172a')
  acento: string;       // color del texto sutil sobre fondo (ej: '#94a3b8')
  eyebrow: string;      // pretítulo en mayúsculas
  titulo: string;       // título principal
  subtitulo?: string;   // subtítulo opcional
}): string {
  return `
    <div style="background:${opts.fondo};padding:24px;color:white;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td style="vertical-align:middle;width:60px;padding-right:16px;">
            ${escudoVanguardImg(48)}
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;letter-spacing:0.22em;color:${opts.acento};text-transform:uppercase;font-weight:600;">${escapeHtml(opts.eyebrow)}</div>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;line-height:1.25;">${escapeHtml(opts.titulo)}</h1>
            ${opts.subtitulo ? `<div style="margin-top:4px;font-size:13px;color:${opts.acento};">${escapeHtml(opts.subtitulo)}</div>` : ''}
          </td>
        </tr>
      </table>
    </div>`;
}

function footer(extra?: string): string {
  return `
    <div style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
      ${extra ? `${extra}<br/>` : ''}
      Email automático generado por <strong style="color:#64748b;">Vanguard</strong>. No respondas a este mensaje.
    </div>`;
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:24px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
    ${inner}
  </div>
</body></html>`;
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
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#64748b;font-size:12px;">${escapeHtml(it.codigo)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.descripcion || '')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${it.cantidad}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.costoUnitario, data.moneda)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatMoney(it.cantidad * it.costoUnitario, data.moneda)}</td>
      </tr>`,
    )
    .join('');

  const html = shell(`
    ${header({ fondo: '#0f172a', acento: '#94a3b8', eyebrow: 'Vanguard ERP', titulo: 'Nueva orden de compra', subtitulo: `${data.numero} · ${data.proveedorNombre}` })}

    <div style="padding:28px 24px;">
      <p style="margin:0 0 20px;color:#475569;line-height:1.55;">
        Se creó una nueva orden de compra en el sistema. Detalle abajo.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:140px;">Número</td><td style="padding:10px 14px;font-weight:600;">${escapeHtml(data.numero)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Proveedor</td><td style="padding:10px 14px;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(data.proveedorNombre)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Creada por</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(data.creadoPor)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Fecha creación</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(data.fechaCreacion)}</td></tr>
        ${data.fechaEsperada ? `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Fecha esperada</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(data.fechaEsperada)}</td></tr>` : ''}
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Total</td><td style="padding:10px 14px;font-weight:700;font-size:16px;color:#0f172a;border-top:1px solid #e2e8f0;">${formatMoney(data.total, data.moneda)}</td></tr>
      </table>

      <h3 style="font-size:13px;color:#64748b;margin:24px 0 8px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Items (${data.items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Código</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Descripción</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Cantidad</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Costo unit.</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${data.notas ? `<div style="margin-top:24px;padding:14px 16px;background:#fef9c3;border-left:3px solid #ca8a04;border-radius:6px;"><div style="font-size:11px;color:#854d0e;font-weight:700;margin-bottom:4px;letter-spacing:0.04em;text-transform:uppercase;">Notas</div><div style="color:#422006;font-size:14px;line-height:1.55;">${escapeHtml(data.notas)}</div></div>` : ''}

      ${data.linkOC ? `<div style="margin-top:28px;text-align:center;"><a href="${escapeHtml(data.linkOC)}" style="display:inline-block;background:#2563eb;color:white;padding:11px 22px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Ver en Vanguard →</a></div>` : ''}
    </div>

    ${footer()}
  `);

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
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#64748b;font-size:12px;">${escapeHtml(it.codigo)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.descripcion || '')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${it.cantidad}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatMoney(it.costoUnitario, data.moneda)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatMoney(it.cantidad * it.costoUnitario, data.moneda)}</td>
      </tr>`,
    )
    .join('');

  const html = shell(`
    ${header({ fondo: '#1e3a8a', acento: '#bfdbfe', eyebrow: data.nombreEmpresa, titulo: `Orden de compra ${data.numero}`, subtitulo: data.fechaEsperada ? `Fecha esperada: ${data.fechaEsperada}` : undefined })}

    <div style="padding:28px 24px;">
      <p style="margin:0 0 14px;font-size:15px;">Estimados,</p>
      <p style="margin:0 0 18px;color:#334155;line-height:1.55;">
        Adjunto la orden de compra <strong>${escapeHtml(data.numero)}</strong> de <strong>${escapeHtml(data.nombreEmpresa)}</strong>${data.fechaEsperada ? ` con fecha esperada de entrega <strong>${escapeHtml(data.fechaEsperada)}</strong>` : ''}.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Código</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Descripción</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Cantidad</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Costo unit.</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:14px 8px;text-align:right;font-weight:600;border-top:2px solid #e2e8f0;">Total</td><td style="padding:14px 8px;text-align:right;font-weight:700;font-size:16px;border-top:2px solid #e2e8f0;">${formatMoney(data.total, data.moneda)}</td></tr>
        </tfoot>
      </table>

      ${data.notas ? `<div style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-left:3px solid #64748b;border-radius:6px;"><div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px;letter-spacing:0.04em;text-transform:uppercase;">Notas adicionales</div><div style="color:#0f172a;font-size:14px;line-height:1.55;">${escapeHtml(data.notas)}</div></div>` : ''}

      <p style="margin:28px 0 8px;color:#334155;line-height:1.55;">Por favor confirmá la recepción de esta orden y la fecha estimada de entrega.</p>
      <p style="margin:0;color:#475569;line-height:1.55;">Saludos,<br/><strong>${escapeHtml(data.contactoCompras || data.creadoPor)}</strong><br/>${escapeHtml(data.nombreEmpresa)}</p>
    </div>

    ${footer('Esta es una comunicación oficial enviada desde Vanguard.')}
  `);

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

// =====================================================
// SOLICITUD DE INSUMO — interno
// =====================================================
export interface SolicitudInsumoEmailData {
  numero: string;
  categoria: string;
  categoriaLabel?: string;
  solicitadoPor: string;
  fechaSolicitud: string;
  fechaLimite?: string | null;
  observaciones?: string | null;
  items: { descripcion: string; cantidad: number; unidad?: string; observaciones?: string | null }[];
  linkSolicitud?: string;
}

export function templateSolicitudInsumo(data: SolicitudInsumoEmailData): { subject: string; html: string; text: string } {
  const catLabel = data.categoriaLabel || data.categoria;
  const subject = `[Vanguard] Solicitud de insumo ${data.numero} (${catLabel}) — ${data.solicitadoPor}`;

  const itemsHtml = data.items
    .map(it => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(it.descripcion)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${it.cantidad}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;">${escapeHtml(it.unidad || 'unidad')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">${escapeHtml(it.observaciones || '')}</td>
      </tr>`)
    .join('');

  const html = shell(`
    ${header({ fondo: '#0f172a', acento: '#cbd5e1', eyebrow: 'Solicitud de insumo', titulo: `${catLabel} · ${data.numero}`, subtitulo: `Solicitada por ${data.solicitadoPor}` })}

    <div style="padding:28px 24px;">
      <p style="margin:0 0 18px;color:#475569;line-height:1.55;">
        <strong>${escapeHtml(data.solicitadoPor)}</strong> generó una solicitud de insumos en la categoría <strong>${escapeHtml(catLabel)}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:140px;">Número</td><td style="padding:10px 14px;font-weight:600;">${escapeHtml(data.numero)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Solicitante</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(data.solicitadoPor)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Categoría</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(catLabel)}</td></tr>
        <tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Fecha solicitud</td><td style="padding:10px 14px;border-top:1px solid #e2e8f0;">${escapeHtml(data.fechaSolicitud)}</td></tr>
        ${data.fechaLimite ? `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Fecha límite</td><td style="padding:10px 14px;color:#dc2626;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(data.fechaLimite)}</td></tr>` : ''}
      </table>

      <h3 style="font-size:13px;color:#64748b;margin:24px 0 8px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Items solicitados (${data.items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Descripción</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;">Cantidad</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Unidad</th>
            <th style="padding:10px 8px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Observ.</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      ${data.observaciones ? `<div style="margin-top:24px;padding:14px 16px;background:#fef9c3;border-left:3px solid #ca8a04;border-radius:6px;"><div style="font-size:11px;color:#854d0e;font-weight:700;margin-bottom:4px;letter-spacing:0.04em;text-transform:uppercase;">Observaciones de la solicitud</div><div style="color:#422006;font-size:14px;line-height:1.55;">${escapeHtml(data.observaciones)}</div></div>` : ''}

      ${data.linkSolicitud ? `<div style="margin-top:28px;text-align:center;"><a href="${escapeHtml(data.linkSolicitud)}" style="display:inline-block;background:#2d5480;color:white;padding:11px 22px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Gestionar solicitud →</a></div>` : ''}
    </div>

    ${footer('Si recibís esto como gestor, sos responsable de resolver esta solicitud. Si sos referente, es a título informativo.')}
  `);

  const text = [
    `Solicitud de insumo ${data.numero}`,
    `Categoría: ${catLabel}`,
    `Solicitante: ${data.solicitadoPor}`,
    `Fecha solicitud: ${data.fechaSolicitud}`,
    data.fechaLimite ? `Fecha límite: ${data.fechaLimite}` : '',
    '',
    `Items (${data.items.length}):`,
    ...data.items.map(it => `  - ${it.descripcion} — ${it.cantidad} ${it.unidad || 'unidad'}${it.observaciones ? ` (${it.observaciones})` : ''}`),
    '',
    data.observaciones ? `Observaciones: ${data.observaciones}` : '',
    '',
    data.linkSolicitud ? `Ver/gestionar: ${data.linkSolicitud}` : '',
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}
