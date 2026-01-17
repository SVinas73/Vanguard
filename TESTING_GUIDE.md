# 🧪 GUÍA DE PRUEBAS - FASE 1 COMPLETA

## ⚠️ ANTES DE EMPEZAR

**IMPORTANTE:** Si solo tienes un ambiente de producción, haz un **backup de la base de datos** antes de ejecutar la migración.

---

## PASO 1: EJECUTAR MIGRACIÓN SQL EN SUPABASE

### Opción A: Desde el Dashboard de Supabase (RECOMENDADO)

1. **Accede a Supabase:**
   ```
   https://app.supabase.com
   ```

2. **Selecciona tu proyecto** (Vanguard)

3. **Ve a SQL Editor:**
   - En el menú lateral izquierdo, clic en "SQL Editor"
   - O directamente: https://app.supabase.com/project/[TU_PROJECT_ID]/sql

4. **Crea una nueva query:**
   - Clic en el botón "+ New query"

5. **Copia y pega el contenido del archivo:**
   - Abre: `/home/user/Vanguard/database/migrations/001_traceability_serialization.sql`
   - Copia TODO el contenido (700+ líneas)
   - Pégalo en el editor SQL de Supabase

6. **Ejecuta la migración:**
   - Clic en el botón "Run" (o presiona Ctrl+Enter)
   - **Espera** (puede tomar 10-30 segundos)

7. **Verifica el resultado:**
   - Deberías ver al final:
     ```
     "Migración 001_traceability_serialization.sql completada exitosamente"
     "Tablas creadas: productos_seriales, trazabilidad, rma, rma_items, bom, bom_items, ensamblajes"
     ```

### Opción B: Desde CLI (Avanzado)

```bash
# Si tienes Supabase CLI instalado
cd /home/user/Vanguard
supabase db push

# O con psql directamente
psql "postgresql://postgres:[PASSWORD]@[SUPABASE_URL]:5432/postgres" \
  -f database/migrations/001_traceability_serialization.sql
```

---

## PASO 2: VERIFICAR QUE LAS TABLAS SE CREARON

### En Supabase Dashboard:

1. **Ve a Table Editor:**
   - Menú lateral → "Table Editor"

2. **Verifica que existen estas tablas nuevas:**
   - ✅ `productos_seriales`
   - ✅ `trazabilidad`
   - ✅ `rma`
   - ✅ `rma_items`
   - ✅ `bom`
   - ✅ `bom_items`
   - ✅ `ensamblajes`

3. **Verifica que la tabla `productos` tiene nuevas columnas:**
   - Abre la tabla `productos`
   - Deberías ver columnas nuevas:
     - `requiere_serial` (boolean)
     - `patron_serial` (varchar)
     - `tipo_producto` (varchar)
     - `tiene_bom` (boolean)
     - `dias_garantia` (integer)

4. **Verifica que la tabla `lotes` tiene nuevas columnas:**
   - Abre la tabla `lotes`
   - Deberías ver:
     - `proveedor_id`
     - `fecha_caducidad`
     - `estado_calidad`
     - `certificados` (jsonb)

---

## PASO 3: INICIAR LA APLICACIÓN

```bash
cd /home/user/Vanguard

# Instalar dependencias (si no lo has hecho)
npm install

# Iniciar en modo desarrollo
npm run dev
```

**Abre en el navegador:**
```
http://localhost:3000
```

---

## PASO 4: PRUEBAS POR MÓDULO

### 🔹 MÓDULO 1: SERIALES

#### 4.1. Preparar un Producto para Serialización

1. **Ve a la pestaña "Stock"**
2. **Edita un producto existente** (o crea uno nuevo):
   - Código: `LAPTOP001`
   - Descripción: `Laptop Gaming RTX 4060`
   - Precio: `1500`
   - Categoría: `Oficina`

3. **En Supabase, actualiza el producto para que requiera serial:**
   ```sql
   UPDATE productos
   SET
     requiere_serial = true,
     patron_serial = 'LAP-{YEAR}-{SEQUENCE}',
     tipo_producto = 'serializado',
     dias_garantia = 365
   WHERE codigo = 'LAPTOP001';
   ```

#### 4.2. Crear Seriales

1. **Ve a la pestaña "Seriales"** (en el menú lateral, sección "Trazabilidad Enterprise")

2. **Clic en "Nuevo Serial"**

3. **Crear serial individual:**
   - Producto: `LAPTOP001`
   - Número de Serie: (dejar vacío para auto-generar)
   - Almacén: (selecciona uno)
   - Ubicación: `A1-R2-N3-P4`
   - Costo: `1200`
   - Garantía: `12` meses
   - Clic en "Crear Serial"

4. **Verificar:**
   - ✅ Deberías ver el serial con número auto-generado: `LAP-2026-000001`
   - ✅ Estado: "DISPONIBLE"
   - ✅ Garantía: "Vigente"

5. **Crear seriales en masa:**
   - Clic en "Generación Masiva"
   - Producto: `LAPTOP001`
   - Cantidad: `5`
   - Almacén: (selecciona uno)
   - Costo: `1200`
   - Garantía: `365` días
   - Clic en "Generar 5 Seriales"

6. **Verificar:**
   - ✅ Deberías ver 6 seriales en total (1 + 5)
   - ✅ Números consecutivos: `LAP-2026-000001` a `LAP-2026-000006`

#### 4.3. Dashboard de Seriales

**Verifica que veas:**
- ✅ Total Seriales: 6
- ✅ Disponibles: 6
- ✅ Valor Disponible: $7,200 (6 × $1,200)

---

### 🔹 MÓDULO 2: TRAZABILIDAD

#### 5.1. Ver Trazabilidad de un Serial

1. **Ve a la pestaña "Trazabilidad"**

2. **Deberías ver eventos automáticos:**
   - ✅ RECEPCION - para cada serial creado
   - ✅ Fecha/hora
   - ✅ Usuario responsable
   - ✅ Almacén destino

3. **Filtrar por tipo de evento:**
   - Selecciona "Recepción"
   - Deberías ver solo los 6 eventos de recepción

#### 5.2. Ver Cadena Completa de un Serial

1. **Haz clic en un evento para expandir detalles**

2. **Verifica que veas:**
   - ✅ Timeline visual
   - ✅ Iconos por tipo de evento
   - ✅ Ubicación destino
   - ✅ Usuario responsable
   - ✅ Metadata (estado_nuevo, etc.)

---

### 🔹 MÓDULO 3: RMA (DEVOLUCIONES)

#### 6.1. Crear una Devolución

**Primero necesitas un cliente:**

1. **Ve a la pestaña "Ventas"**
2. **Crea un cliente si no tienes:**
   - Código: `CLI001`
   - Tipo: `Persona`
   - Nombre: `Juan Pérez`
   - Email: `juan@email.com`

**Ahora crea el RMA:**

1. **Ve a la pestaña "Devoluciones (RMA)"**

2. **Clic en "Nueva Devolución"**

3. **Completa el formulario:**
   - Cliente: `Juan Pérez`
   - Tipo: `Defecto`
   - Motivo: `Pantalla con píxeles muertos`
   - Resolución Esperada: `Reemplazo`

4. **Clic en "Crear RMA"**

5. **Verificar:**
   - ✅ Número RMA auto-generado (ej: `RMA-12345678`)
   - ✅ Estado: "SOLICITADA"
   - ✅ Fecha de solicitud: hoy

#### 6.2. Aprobar/Procesar RMA

1. **En la tabla de RMAs, clic en el ícono de "Aprobar" (✓)**

2. **Verificar:**
   - ✅ Estado cambia a "APROBADA"

3. **Clic en "En Tránsito" (reloj)**

4. **Verificar:**
   - ✅ Estado cambia a "EN_TRANSITO"

#### 6.3. Dashboard de RMAs

**Verifica que veas:**
- ✅ Total RMAs: 1
- ✅ Solicitadas: 0
- ✅ Aprobadas: 0
- ✅ En tránsito: 1

---

### 🔹 MÓDULO 4: BOM (BILL OF MATERIALS)

#### 7.1. Preparar Componentes

**Necesitas productos que serán componentes:**

1. **Ve a "Stock" y crea estos productos:**
   ```
   Producto 1:
   - Código: COMP-001
   - Descripción: Motherboard Z790
   - Precio: 250
   - Stock: 20

   Producto 2:
   - Código: COMP-002
   - Descripción: CPU Intel i7
   - Precio: 400
   - Stock: 15

   Producto 3:
   - Código: COMP-003
   - Descripción: RAM 16GB DDR5
   - Precio: 100
   - Stock: 50

   Producto 4:
   - Código: COMP-004
   - Descripción: SSD 1TB NVMe
   - Precio: 150
   - Stock: 30
   ```

2. **Asegúrate de que tengan `costo_promedio`:**
   ```sql
   UPDATE productos SET costo_promedio = precio WHERE codigo IN ('COMP-001', 'COMP-002', 'COMP-003', 'COMP-004');
   ```

#### 7.2. Crear un BOM

1. **Ve a la pestaña "BOM"**

2. **Clic en "Nuevo BOM"**

3. **Columna izquierda - Info del BOM:**
   - Producto Final: `LAPTOP001 - Laptop Gaming RTX 4060`
   - Versión: `1.0`
   - Tipo: `Producción`
   - Nombre: `Ensamblaje Estándar`
   - Cantidad Base: `1`
   - Mano de Obra: `50`
   - Overhead: `30`
   - Tiempo Setup: `15` min
   - Tiempo Ensamblaje: `60` min

4. **Columna derecha - Agregar Componentes:**

   **Componente 1:**
   - Seleccionar: `COMP-001 - Motherboard Z790`
   - Cantidad: `1`
   - Desperdicio: `0`
   - Crítico: ✅ (marcar)
   - Clic en "Agregar"

   **Componente 2:**
   - Seleccionar: `COMP-002 - CPU Intel i7`
   - Cantidad: `1`
   - Crítico: ✅
   - Clic en "Agregar"

   **Componente 3:**
   - Seleccionar: `COMP-003 - RAM 16GB DDR5`
   - Cantidad: `2`
   - Crítico: ✅
   - Clic en "Agregar"

   **Componente 4:**
   - Seleccionar: `COMP-004 - SSD 1TB NVMe`
   - Cantidad: `1`
   - Crítico: ✅
   - Clic en "Agregar"

5. **Verificar Resumen de Costos (abajo izquierda):**
   ```
   Materiales: $1,000 (250+400+200+150)
   Mano de Obra: $50
   Overhead: $30
   ─────────────────
   TOTAL: $1,080
   ```

6. **Clic en "Crear BOM"**

7. **Verificar:**
   - ✅ BOM creado exitosamente
   - ✅ Estado: "BORRADOR"
   - ✅ 4 componentes
   - ✅ Costo Total: $1,080

#### 7.3. Activar el BOM

1. **En la tabla, clic en el ícono de "Activar" (✓)**

2. **Verificar:**
   - ✅ Estado cambia a "ACTIVO"
   - ✅ Badge "Principal" aparece

#### 7.4. Dashboard de BOMs

**Verifica que veas:**
- ✅ Total BOMs: 1
- ✅ Activos: 1
- ✅ Borradores: 0
- ✅ Costo Prom. Materiales: $1,000

---

### 🔹 MÓDULO 5: ENSAMBLAJES

#### 8.1. Crear Orden de Ensamblaje

1. **Ve a la pestaña "Ensamblajes"**

2. **Clic en "Nuevo Ensamblaje"**

3. **Completar formulario:**
   - BOM: `Laptop Gaming RTX 4060 - v1.0`
   - Cantidad: `3`
   - Almacén: (selecciona el que tenga stock)
   - Generar seriales: ✅ (marcar)

4. **Clic en "Crear"**

**El sistema valida automáticamente:**
```
✅ VALIDACIÓN:
- Motherboard: Necesito 3, Tengo 20 ✓
- CPU: Necesito 3, Tengo 15 ✓
- RAM: Necesito 6, Tengo 50 ✓
- SSD: Necesito 3, Tengo 30 ✓

✓ Ensamblaje creado. Ejecute para producir.
```

5. **Verificar:**
   - ✅ Número ASM auto-generado (ej: `ASM-87654321`)
   - ✅ Estado: "PLANIFICADO"
   - ✅ Cantidad: 0 / 3

#### 8.2. Ejecutar Ensamblaje

1. **En la tabla, clic en el ícono de "Ejecutar" (▶️)**

2. **Confirmar:**
   - "¿Iniciar producción de 3 unidades?"
   - Clic en "OK"

**El sistema ejecuta automáticamente:**
```
1. Cambia estado a "EN_PROCESO"
2. Crea movimientos de SALIDA de componentes:
   - Salida: 3 Motherboard
   - Salida: 3 CPU
   - Salida: 6 RAM
   - Salida: 3 SSD
3. Actualiza stock de componentes:
   - Motherboard: 20 → 17
   - CPU: 15 → 12
   - RAM: 50 → 44
   - SSD: 30 → 27
4. Crea movimiento de ENTRADA:
   - Entrada: 3 Laptop Gaming
5. Actualiza stock del producto final:
   - LAPTOP001: 0 → 3
6. Genera 3 seriales nuevos:
   - LAP-2026-000007
   - LAP-2026-000008
   - LAP-2026-000009
7. Registra eventos de trazabilidad
8. Cambia estado a "COMPLETADO"
```

3. **Verificar mensaje:**
   ```
   ✓ Ensamblaje completado: 3 unidades producidas
   ```

4. **Verificar en la tabla:**
   - ✅ Estado: "COMPLETADO" (✓ verde)
   - ✅ Cantidad: 3 / 3

#### 8.3. Verificar Stock Actualizado

1. **Ve a "Stock"**

2. **Busca `LAPTOP001`:**
   - ✅ Stock: 3 (antes era 0)

3. **Busca los componentes:**
   - ✅ `COMP-001`: Stock 17 (antes 20)
   - ✅ `COMP-002`: Stock 12 (antes 15)
   - ✅ `COMP-003`: Stock 44 (antes 50)
   - ✅ `COMP-004`: Stock 27 (antes 30)

#### 8.4. Verificar Seriales Generados

1. **Ve a "Seriales"**

2. **Deberías ver ahora 9 seriales totales:**
   - 6 creados manualmente antes
   - 3 generados por el ensamblaje

3. **Filtra por "LAP-2026-00000"**

4. **Verifica los últimos 3:**
   - ✅ `LAP-2026-000007`
   - ✅ `LAP-2026-000008`
   - ✅ `LAP-2026-000009`
   - ✅ Estado: "DISPONIBLE"
   - ✅ Notas: "Generado por ensamblaje ASM-..."

#### 8.5. Verificar Trazabilidad del Ensamblaje

1. **Ve a "Trazabilidad"**

2. **Busca eventos recientes**

3. **Deberías ver:**
   - ✅ 4 eventos de "ENSAMBLAJE" para componentes (Motherboard, CPU, RAM, SSD)
   - ✅ 1 evento de "ENSAMBLAJE" para el producto final (Laptop)
   - ✅ Cada evento tiene metadata:
     - Cantidad consumida/producida
     - Documento: ASM-xxxxx
     - Almacén

4. **Haz clic en un evento para ver detalles completos**

#### 8.6. Dashboard de Ensamblajes

**Verifica que veas:**
- ✅ Total: 1
- ✅ En Proceso: 0
- ✅ Completados: 1

---

## PASO 5: VERIFICACIÓN FINAL

### ✅ Checklist Completo

**Base de Datos:**
- ✅ 7 tablas nuevas creadas
- ✅ Productos actualizados con campos de serialización
- ✅ Lotes actualizados con campos de trazabilidad

**Módulo Seriales:**
- ✅ Crear serial individual ✓
- ✅ Generación masiva ✓
- ✅ Números auto-generados ✓
- ✅ Dashboard con stats ✓

**Módulo Trazabilidad:**
- ✅ Ver eventos de RECEPCION ✓
- ✅ Timeline visual ✓
- ✅ Filtros funcionando ✓

**Módulo RMA:**
- ✅ Crear devolución ✓
- ✅ Cambiar estados ✓
- ✅ Dashboard con stats ✓

**Módulo BOM:**
- ✅ Crear BOM con componentes ✓
- ✅ Cálculo de costos ✓
- ✅ Activar BOM ✓
- ✅ Dashboard con stats ✓

**Módulo Ensamblaje:**
- ✅ Crear orden ✓
- ✅ Validación automática ✓
- ✅ Ejecución ✓
- ✅ Consumo de componentes ✓
- ✅ Generación de producto final ✓
- ✅ Generación de seriales ✓
- ✅ Trazabilidad automática ✓

---

## 🐛 PROBLEMAS COMUNES

### Error: "relation does not exist"

**Causa:** La migración SQL no se ejecutó correctamente.

**Solución:**
1. Ve a Supabase → SQL Editor
2. Ejecuta:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%serial%';
   ```
3. Si no muestra `productos_seriales`, vuelve a ejecutar la migración completa.

### Error: "supabase.rpc is not a function"

**Causa:** La función `generar_numero_serial` no existe.

**Solución:**
```sql
-- Verificar que existe la función
SELECT proname FROM pg_proc WHERE proname = 'generar_numero_serial';

-- Si no existe, ejecuta de nuevo la sección de FUNCIONES del SQL
```

### Error: "requiere_serial column does not exist"

**Causa:** Las columnas nuevas de `productos` no se agregaron.

**Solución:**
```sql
-- Verificar columnas de productos
SELECT column_name FROM information_schema.columns
WHERE table_name = 'productos' AND column_name LIKE '%serial%';

-- Si no están, ejecuta de nuevo la sección "MEJORAS A TABLA PRODUCTOS"
```

### Los seriales no se auto-generan

**Verificar:**
1. Que el producto tenga `requiere_serial = true`
2. Que tenga un `patron_serial` definido
3. Que la función SQL exista

### El ensamblaje no consume componentes

**Verificar:**
1. Que los componentes tengan stock
2. Que el BOM esté en estado "ACTIVO"
3. Revisa la consola del navegador para ver errores

---

## 📊 DATOS DE EJEMPLO COMPLETOS

Si quieres cargar datos de ejemplo completos, ejecuta este SQL:

```sql
-- Insertar productos de ejemplo
INSERT INTO productos (codigo, descripcion, precio, categoria, stock, stock_minimo, costo_promedio, requiere_serial) VALUES
('LAPTOP001', 'Laptop Gaming RTX 4060', 1500, 'Oficina', 0, 5, 1200, true),
('COMP-001', 'Motherboard Z790', 250, 'Oficina', 20, 5, 200, false),
('COMP-002', 'CPU Intel i7', 400, 'Oficina', 15, 3, 350, false),
('COMP-003', 'RAM 16GB DDR5', 100, 'Oficina', 50, 10, 80, false),
('COMP-004', 'SSD 1TB NVMe', 150, 'Oficina', 30, 5, 120, false)
ON CONFLICT (codigo) DO UPDATE SET
  precio = EXCLUDED.precio,
  costo_promedio = EXCLUDED.costo_promedio,
  requiere_serial = EXCLUDED.requiere_serial;

-- Configurar laptop para serialización
UPDATE productos SET
  tipo_producto = 'serializado',
  patron_serial = 'LAP-{YEAR}-{SEQUENCE}',
  dias_garantia = 365
WHERE codigo = 'LAPTOP001';
```

---

## 🎯 SIGUIENTE PASO

Una vez que hayas verificado que **TODO funciona correctamente**, estás listo para:

1. **Continuar con FASE 2** (Sistema de Calidad - QMS)
2. **Continuar con FASE 3** (WMS Avanzado)
3. **Crear más funcionalidades**

---

## 📞 SOPORTE

Si encuentras algún error:

1. Revisa la consola del navegador (F12 → Console)
2. Revisa los logs de Supabase (Dashboard → Logs)
3. Verifica que todas las tablas existan
4. Asegúrate de que el `.env.local` tenga las credenciales correctas

---

**¡Listo para probar!** 🚀
