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
    // El cliente de Supabase no lanza excepciones: devuelve { error }. Antes
    // ese error se perdía y un registro de auditoría podía faltar sin aviso.
    const { error } = await supabase.from('auditoria').insert({
      tabla,
      accion,
      codigo,
      datos_anteriores: datosAnteriores,
      datos_nuevos: datosNuevos,
      usuario_email: usuarioEmail,
    });
    if (error) console.error(`Error registrando auditoría (${tabla}/${accion}):`, error.message);
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}
