# Migraciones de Base de Datos - Vanguard

## Instrucciones de Instalación

### 1. Ejecutar Migración de Trazabilidad y Serialización

Para aplicar la migración `001_traceability_serialization.sql` en tu base de datos de Supabase:

**Opción A - Desde el Dashboard de Supabase:**

1. Accede a tu proyecto en https://app.supabase.com
2. Ve a la sección "SQL Editor"
3. Copia y pega el contenido del archivo `/database/migrations/001_traceability_serialization.sql`
4. Ejecuta el script haciendo clic en "Run"
5. Verifica que aparezca el mensaje de éxito al final

**Opción B - Desde la CLI de Supabase:**

```bash
# Si tienes Supabase CLI instalado
supabase db push

# O ejecuta el archivo directamente
psql "postgresql://postgres:[POSTGRES_PASSWORD]@[SUPABASE_URL]:5432/postgres" -f database/migrations/001_traceability_serialization.sql
```

### 2. Verificar la Migración

Después de ejecutar la migración, verifica que se crearon las siguientes tablas:

- ✅ `productos_seriales` - Números de serie individuales
- ✅ `trazabilidad` - Eventos de trazabilidad
- ✅ `rma` y `rma_items` - Sistema de devoluciones
- ✅ `bom` y `bom_items` - Bill of Materials
- ✅ `ensamblajes` - Registro de ensamblajes

Y las siguientes vistas:

- ✅ `v_inventario_serializado`
- ✅ `v_trazabilidad_completa`
- ✅ `v_rma_activas`
- ✅ `v_costos_ensamblaje`

### 3. Configurar Variables de Entorno

Asegúrate de que tu archivo `.env.local` tenga las credenciales correctas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
NEXT_PUBLIC_AI_API_URL=http://localhost:8000  # Si usas el servicio de IA
```

### 4. Permisos y RLS

Las políticas de Row Level Security (RLS) están configuradas para permitir acceso a usuarios autenticados. Si necesitas personalizar los permisos por rol:

1. Edita las políticas en el archivo SQL antes de ejecutar, o
2. Modifica las políticas desde el Dashboard de Supabase → Authentication → Policies

### 5. Datos de Prueba (Opcional)

Si deseas crear datos de prueba, descomenta la sección "DATOS DE EJEMPLO" al final del archivo SQL.

## Estructura de las Nuevas Tablas

### Serialización (`productos_seriales`)

Almacena números de serie únicos para cada unidad de producto:

```sql
SELECT * FROM productos_seriales WHERE estado = 'disponible';
```

### Trazabilidad (`trazabilidad`)

Registro completo de eventos:

```sql
SELECT * FROM v_trazabilidad_completa
WHERE producto_codigo = 'PROD001'
ORDER BY fecha_hora DESC;
```

### RMA (Return Merchandise Authorization)

Sistema de gestión de devoluciones:

```sql
SELECT * FROM v_rma_activas;
```

### BOM (Bill of Materials)

Listas de materiales para productos ensamblados:

```sql
SELECT * FROM v_costos_ensamblaje;
```

## Funciones Disponibles

### `generar_numero_serial(producto_codigo, patron)`

Genera automáticamente números de serie:

```sql
SELECT generar_numero_serial('LAPTOP001');
-- Resultado: SN-2026-000001

SELECT generar_numero_serial('PHONE001', 'PHONE-{YEAR}-{SEQUENCE}');
-- Resultado: PHONE-2026-000001
```

## Triggers Automáticos

### Trazabilidad Automática

Los triggers registran automáticamente eventos cuando:

- Se crea un nuevo serial → Evento de RECEPCION
- Se cambia el estado de un serial → Evento de CAMBIO_ESTADO
- Se mueve un serial entre almacenes → Evento de TRANSFERENCIA

## Próximos Pasos

Después de aplicar la migración:

1. ✅ Actualiza los componentes de React para usar las nuevas tablas
2. ✅ Configura los permisos específicos por rol si es necesario
3. ✅ Prueba la creación de seriales desde la interfaz
4. ✅ Verifica la trazabilidad de productos
5. ✅ Configura alertas para RMAs pendientes

## Rollback (Reversión)

Si necesitas revertir la migración:

```sql
-- ADVERTENCIA: Esto eliminará todas las tablas y datos

DROP TABLE IF EXISTS ensamblajes CASCADE;
DROP TABLE IF EXISTS bom_items CASCADE;
DROP TABLE IF EXISTS bom CASCADE;
DROP TABLE IF EXISTS rma_items CASCADE;
DROP TABLE IF EXISTS rma CASCADE;
DROP TABLE IF EXISTS trazabilidad CASCADE;
DROP TABLE IF EXISTS productos_seriales CASCADE;

DROP VIEW IF EXISTS v_inventario_serializado;
DROP VIEW IF EXISTS v_trazabilidad_completa;
DROP VIEW IF EXISTS v_rma_activas;
DROP VIEW IF EXISTS v_costos_ensamblaje;

DROP FUNCTION IF EXISTS generar_numero_serial(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS actualizar_updated_at();
DROP FUNCTION IF EXISTS registrar_trazabilidad_serial();
```

## Soporte

Si encuentras problemas:

1. Verifica los logs de Supabase en el Dashboard
2. Revisa que las extensiones necesarias estén habilitadas (uuid-ossp)
3. Asegúrate de tener permisos de administrador en la base de datos
4. Consulta la documentación de Supabase: https://supabase.com/docs

---

**Fecha de creación:** 2026-01-17
**Versión:** 001
**Autor:** Sistema Vanguard - FASE 1 Trazabilidad
