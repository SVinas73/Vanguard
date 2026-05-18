# Integración Churn Detection — Vanguard-IA

Archivos para copiar al repo **Vanguard-IA** (https://github.com/SVinas73/Vanguard-IA) para sumar predicción de churn con XGBoost entrenado sobre datos de Supabase.

## Instalación

### 1. Copiar el router

```bash
# Desde la raíz de tu repo Vanguard-IA:
cp /ruta/a/vanguard-ia-additions/churn.py routers/churn.py
```

### 2. Modificar `main.py`

Agregá la importación y el include:

```python
# Imports (arriba con los otros routers)
from routers import predictions, anomalies, associations, churn

# Después de los include_router existentes
app.include_router(churn.router, prefix="/churn", tags=["churn"])
```

### 3. Variables de entorno

Añadí a tu `.env` de Vanguard-IA:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-key
```

> Usá la **service role key** (no la anon key) — el modelo necesita leer todas las tablas.

### 4. Reiniciar

```bash
uvicorn main:app --reload
```

## Endpoints

| Método | Path | Qué hace |
|---|---|---|
| `POST` | `/churn/train` | Entrena XGBoost con datos actuales. Devuelve AUC y feature importance. |
| `GET` | `/churn/scores?limit=100&min_risk=0.5` | Lista clientes ordenados por probabilidad de churn. |
| `GET` | `/churn/score/{cliente_id}` | Score detallado de un cliente con sus features. |
| `GET` | `/churn/summary` | Resumen: cuántos en cada nivel de riesgo. |
| `GET` | `/churn/health` | Estado del modelo (si está entrenado, AUC, etc). |

## Modelo

- **Algoritmo**: XGBoost Classifier (100 trees, depth 5, lr 0.1)
- **Target**: cliente con `dias_desde_ultima_compra >= 90`
- **Features**:
  - `total_gastado_12m` — LTV últimos 12 meses
  - `cantidad_compras_12m` — frecuencia
  - `ticket_promedio` — gasto promedio por orden
  - `cantidad_rmas` — devoluciones
  - `cantidad_tickets` — quejas de soporte
  - `cxc_total` y `cxc_vencidas_pct` — situación de cobranza
  - `garantias_activas`
  - `meses_como_cliente` — antigüedad
  - `tendencia_pct` — % cambio gasto últimos 6m vs 6m anteriores
  - `cantidad_6m_reciente` y `cantidad_6m_anterior`
- **Niveles**:
  - `critico` ≥ 75% probabilidad
  - `alto` ≥ 50%
  - `medio` ≥ 25%
  - `bajo` < 25%

## Notas

- El modelo se entrena automáticamente la primera vez que se pide `/scores` o `/score/{id}` si todavía no se entrenó.
- Para re-entrenar después de un sync de datos grande: hacer un `POST /churn/train` manual.
- El AUC esperado con dataset chico (50-200 clientes) suele rondar 0.7-0.85. Con más datos sube.

## Tests sugeridos (opcional)

```python
# tests/test_churn.py
def test_train():
    response = client.post("/churn/train")
    assert response.status_code == 200
    assert response.json()["entrenado"] is True
    assert response.json()["auc_test"] > 0.5  # mejor que random

def test_scores():
    response = client.get("/churn/scores?limit=10")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```
