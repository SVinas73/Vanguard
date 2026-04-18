import { supabase } from '@/lib/supabase';

export async function registrarAuditoria(
  tabla: string,
  accion: string,
  codigo: string | null,
  datosAnteriores: any,
  datosNuevos: any,
  usuarioEmail: string
) {
  try {
    await supabase.from('auditoria').insert({
      tabla,
      accion,
      codigo,
      datos_anteriores: datosAnteriores,
      datos_nuevos: datosNuevos,
      usuario_email: usuarioEmail,
    });
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}
