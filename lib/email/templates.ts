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
  const h = size;
  // Símbolo Vanguard embebido en base64 (PNG 96×96, ~1 KB). Va inline en el email
  // así NO depende de una URL externa (Gmail/Outlook no cargan imágenes
  // pesadas o de dominios no confiables) ni del valor de NEXT_PUBLIC_APP_URL.
  const VANG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAwFBMVEVonO9tofIlWbNlm+8mWrVAe98za8smWbUog+FBdt1DfN4hU62FsPuFt/wwZ8ZgluyHuP01bs41bc5ASr9AgL9Aet6As/r///8AgICOxv8AAABLh+o7ddcyach0p/RCfeFlmu4mWraFtvxckupBe94rYL1OjfN+sPlMhe+Kuv47dNpLh+pLiOxMhuhMiO07ddJJhOc5ddaAgP87ddY7ddY7ddmDuvwA//80bMxzpvQAAP8lWLMvZcM8dtpBfeB0p/Xknih2AAAAQHRSTlMZmyBdWFoV1wctnLUjzpLQcFbZBQTPnAECCQD+/v7+/v7+/v7+/0P+DUNCKtGqbRCKKwKPrs4MAXLNAZGydtlOf+Bz3AAAA2dJREFUeNrtmWtXqkAUhgFRtOyidjnHsizNLLOLlZpZ/f9/VeAl9suePTPI+XDWYs8HlwPMwwPMMLNxmv84nByQA3JADjAEVG9ojMPKQY9GX9tWH44YrAE3lzT2w8reCY17LeAejiisAcc7QPgb1t7B/jqFPux/F7sHmSigQC8GGIPCTngXRqBwNxLbV+y+fIr2QeFGfUqqUAgvAVUA7BwrL6oqFLds1Q82VlDdsRVgjApNSwXVM7fuyUdAqIaVj3DUQNn+APZ8TAwV48trUo44haESMFR1mt+xyL2mYaWgFIgBqgBwuQOHhgIDbjR1z2iMRXVRYMgO1w4AXNk9HsKVjL8PUMExVZCehTjgi1OoGChIjwJ5o71xCtiDyon2y1J/JABUiN4YvXMayVG7CHsUlYAJq/AJx+NdcGD7p/DSZxXEE9Rup4AxKLxFLx5Q+JzRFw1sPhxJ05YCKHxFp9iN4rS7/KWnWFzXL36K4rwIO9vbJHxKTmm8kkNeYWtZnnixCh/QRvwkb2Hbh2Zml1AIKx+gkRdB4EE3dWTHi2dopbLevQJbnrVzU3bIUyu8aASYya/bPosXXuFpufOTToABOG0artTQiwIsTt9dIDjqSyHdfTXAQuFZK8AuQIwVDARYQMFE4cNMgF9C7XEKyR71IA4hEgAVCosxoUXKtDmFmpoxYIIK0Qhcb9FowP+6xSqTVahBg3P4X7MAjNrtTrzshaP2QUuMetlmnVzo0IgUpiJgarUQ7wNgL+q3IqBst9J3bRWmlqkEBwBRZysJgJJtrgIVoungrrL9XetkiHNy0omXoaxQss+2sGuKXVsBAcAuKkq2AlK+iF0ZzNn256kSUuzixmMBXrqMl7HCPGVKrccp+K2rRPHS5uzY9EBwhRGkTgqyCQ4/AfBTAyacwiy4oBHM0qc171kFAPgb5E0T+ZzwxdMAQGOTxCybkvItBHQANiXlEYC3WWr5kVN4NxfQAtg0hGcuoE+Ob9FF6mLU/lV43zj73odl9hZV8DYGNLe65/Fy7sQVtAIGgEqXBlHwMgD8KNCIhrztqP3tTL6ACApeJoDm4WmXlNJKwUDACFDksgW+QSczBcxwcRMpBBdBZl+h2ISHH/iZAQ5A4fXgp/LP9iy772hPtzQq+afGHJADcsD/BfgGoNXaflKyoxEAAAAASUVORK5CYII=';
  return `<img src="data:image/png;base64,${VANG_B64}" width="${w}" height="${h}" alt="Vanguard" style="display:block;border:0;outline:none;text-decoration:none;width:${w}px;height:${h}px;" />`;
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
