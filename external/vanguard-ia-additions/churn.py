"""
Churn Detection Router — Vanguard-IA
=====================================

Predice probabilidad de churn por cliente usando XGBoost entrenado con
datos de Supabase (ventas, RMA, tickets, garantías, CxC).

Pegar este archivo en: routers/churn.py de Vanguard-IA
Luego añadir en main.py:
    from routers import predictions, anomalies, associations, churn
    app.include_router(churn.router, prefix="/churn", tags=["churn"])

Variables de entorno requeridas:
    SUPABASE_URL
    SUPABASE_KEY
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import create_client, Client
import os
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

router = APIRouter()

# Cliente Supabase (singleton)
_supabase: Optional[Client] = None
def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("Falta SUPABASE_URL o SUPABASE_KEY en el entorno")
        _supabase = create_client(url, key)
    return _supabase

# Modelo entrenado en memoria (se reentrena bajo demanda)
_modelo: Optional[XGBClassifier] = None
_scaler: Optional[StandardScaler] = None
_feature_names: List[str] = []
_metricas_entrenamiento: Dict[str, Any] = {}

# =====================================================
# Schemas
# =====================================================

class ChurnScore(BaseModel):
    cliente_id: str
    cliente_nombre: str
    probabilidad_churn: float = Field(ge=0, le=1)
    nivel_riesgo: str  # "critico" | "alto" | "medio" | "bajo"
    razon_principal: str
    features: Dict[str, float]
    fecha_calculo: str

class TrainingResponse(BaseModel):
    entrenado: bool
    auc_test: float
    n_train: int
    n_test: int
    n_clientes_total: int
    feature_importance: Dict[str, float]
    fecha_entrenamiento: str

class ChurnSummary(BaseModel):
    total_clientes: int
    criticos: int
    alto_riesgo: int
    medio_riesgo: int
    bajo_riesgo: int
    fecha_calculo: str

# =====================================================
# Feature engineering
# =====================================================

# Threshold de churn: cliente sin compras en últimos 90 días
CHURN_THRESHOLD_DIAS = 90

# Niveles de riesgo según probabilidad
def nivel_riesgo(p: float) -> str:
    if p >= 0.75: return "critico"
    if p >= 0.50: return "alto"
    if p >= 0.25: return "medio"
    return "bajo"

def _explicacion_principal(features: Dict[str, float]) -> str:
    """Devuelve la razón más probable del riesgo, a partir de heurísticas."""
    dias = features.get("dias_desde_ultima_compra", 0)
    if dias >= 180: return f"{int(dias)} días sin comprar — cliente probablemente perdido"
    if dias >= 90: return f"{int(dias)} días sin comprar"
    cxc = features.get("cxc_vencidas_pct", 0)
    if cxc > 0.3: return f"Tiene {cxc*100:.0f}% de su CxC vencida"
    rmas = features.get("cantidad_rmas", 0)
    if rmas >= 3: return f"{int(rmas)} RMAs reclamadas — alta insatisfacción"
    tickets = features.get("cantidad_tickets", 0)
    if tickets >= 5: return f"{int(tickets)} tickets de soporte en último año"
    tend = features.get("tendencia_pct", 0)
    if tend < -0.3: return f"Compras cayendo {abs(tend)*100:.0f}% vs período anterior"
    return "Combinación de señales débiles"

def _construir_features(cliente_id: str, ahora: datetime, datos: Dict) -> Dict[str, float]:
    """Construye el vector de features para un cliente dado."""
    ordenes = datos["ordenes"].get(cliente_id, [])
    rmas = datos["rmas"].get(cliente_id, [])
    tickets = datos["tickets"].get(cliente_id, [])
    cxc = datos["cxc"].get(cliente_id, [])
    garantias = datos["garantias"].get(cliente_id, [])

    # Ordenes en últimos 12 meses
    hace_12m = ahora - timedelta(days=365)
    hace_6m = ahora - timedelta(days=180)
    ordenes_12m = [o for o in ordenes if o["fecha"] >= hace_12m]
    ordenes_recientes_6m = [o for o in ordenes_12m if o["fecha"] >= hace_6m]
    ordenes_anteriores_6m = [o for o in ordenes_12m if o["fecha"] < hace_6m]

    total_12m = sum(o["total"] for o in ordenes_12m)
    total_6m = sum(o["total"] for o in ordenes_recientes_6m)
    total_anterior_6m = sum(o["total"] for o in ordenes_anteriores_6m)

    cantidad_12m = len(ordenes_12m)
    cantidad_6m_reciente = len(ordenes_recientes_6m)
    cantidad_6m_anterior = len(ordenes_anteriores_6m)

    ultima_compra = max((o["fecha"] for o in ordenes), default=None)
    dias_desde_ultima = (ahora - ultima_compra).days if ultima_compra else 9999

    primera_compra = min((o["fecha"] for o in ordenes), default=None)
    meses_como_cliente = ((ahora - primera_compra).days / 30) if primera_compra else 0

    ticket_promedio = total_12m / cantidad_12m if cantidad_12m else 0

    cxc_total = sum(c["monto"] for c in cxc)
    cxc_vencida_total = sum(c["monto"] for c in cxc if c.get("dias_vencido", 0) > 0)
    cxc_vencidas_pct = (cxc_vencida_total / cxc_total) if cxc_total > 0 else 0

    # Tendencia: % cambio de gasto últimos 6m vs 6m anteriores
    if total_anterior_6m > 0:
        tendencia_pct = (total_6m - total_anterior_6m) / total_anterior_6m
    elif total_6m > 0:
        tendencia_pct = 1.0  # creció desde 0
    else:
        tendencia_pct = -1.0  # cayó a 0

    return {
        "dias_desde_ultima_compra": float(dias_desde_ultima),
        "total_gastado_12m": float(total_12m),
        "cantidad_compras_12m": float(cantidad_12m),
        "ticket_promedio": float(ticket_promedio),
        "cantidad_rmas": float(len(rmas)),
        "cantidad_tickets": float(len(tickets)),
        "cxc_total": float(cxc_total),
        "cxc_vencidas_pct": float(cxc_vencidas_pct),
        "garantias_activas": float(len([g for g in garantias if g.get("activa")])),
        "meses_como_cliente": float(meses_como_cliente),
        "tendencia_pct": float(tendencia_pct),
        "cantidad_6m_reciente": float(cantidad_6m_reciente),
        "cantidad_6m_anterior": float(cantidad_6m_anterior),
    }

def _cargar_datos() -> Dict[str, Any]:
    """Carga todos los datos de Supabase necesarios para feature engineering."""
    sb = _get_supabase()

    clientes_resp = sb.table("clientes").select("id, nombre, codigo, email").execute()
    clientes = clientes_resp.data or []

    ordenes_resp = sb.table("ordenes_venta") \
        .select("cliente_id, total, fecha_orden, estado") \
        .execute()
    ordenes_raw = [o for o in (ordenes_resp.data or []) if o.get("estado") != "cancelada"]

    rmas_resp = sb.table("rma").select("cliente_id, created_at").execute()
    tickets_resp = sb.table("tickets_soporte").select("cliente_id, created_at").execute()
    cxc_resp = sb.table("cuentas_por_cobrar").select("cliente_id, monto_pendiente, dias_vencido").execute()
    garantias_resp = sb.table("garantias").select("cliente_id, fecha_fin, estado").execute()

    # Agrupar por cliente_id
    def agrupar(rows, mapping):
        out = {}
        for r in rows:
            cid = r.get("cliente_id")
            if not cid: continue
            out.setdefault(cid, []).append(mapping(r))
        return out

    ahora = datetime.utcnow()

    ordenes = agrupar(ordenes_raw, lambda r: {
        "total": float(r.get("total") or 0),
        "fecha": datetime.fromisoformat(r["fecha_orden"].replace("Z", "+00:00")).replace(tzinfo=None) if r.get("fecha_orden") else ahora,
    })

    rmas = agrupar(rmas_resp.data or [], lambda r: {"fecha": r.get("created_at")})
    tickets = agrupar(tickets_resp.data or [], lambda r: {"fecha": r.get("created_at")})

    cxc = agrupar(cxc_resp.data or [], lambda r: {
        "monto": float(r.get("monto_pendiente") or 0),
        "dias_vencido": int(r.get("dias_vencido") or 0),
    })

    garantias = agrupar(garantias_resp.data or [], lambda r: {
        "activa": r.get("estado") == "activa",
    })

    return {
        "clientes": clientes,
        "ordenes": ordenes,
        "rmas": rmas,
        "tickets": tickets,
        "cxc": cxc,
        "garantias": garantias,
    }

# =====================================================
# Endpoints
# =====================================================

@router.post("/train", response_model=TrainingResponse)
def train_model():
    """
    Entrena el modelo XGBoost con datos actuales de Supabase.
    Target: cliente con dias_desde_ultima_compra >= 90.
    Usa las features históricas EXCLUYENDO dias_desde_ultima (para no leak).
    """
    global _modelo, _scaler, _feature_names, _metricas_entrenamiento

    datos = _cargar_datos()
    if len(datos["clientes"]) < 30:
        raise HTTPException(400, "Necesito al menos 30 clientes con histórico para entrenar")

    ahora = datetime.utcnow()
    rows = []
    for c in datos["clientes"]:
        f = _construir_features(c["id"], ahora, datos)
        # Target: churned (no compra en últimos 90d)
        churned = 1 if f["dias_desde_ultima_compra"] >= CHURN_THRESHOLD_DIAS else 0
        # Excluir features que filtran el target
        f_train = {k: v for k, v in f.items() if k != "dias_desde_ultima_compra"}
        f_train["_churned"] = churned
        rows.append(f_train)

    df = pd.DataFrame(rows)
    if df["_churned"].nunique() < 2:
        raise HTTPException(400, "No hay variación en el target. ¿Todos tus clientes están en el mismo estado?")

    feature_cols = [c for c in df.columns if c != "_churned"]
    X = df[feature_cols].values
    y = df["_churned"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    modelo = XGBClassifier(
        n_estimators=100, max_depth=5, learning_rate=0.1,
        eval_metric="logloss", use_label_encoder=False, random_state=42,
    )
    modelo.fit(X_train_s, y_train)

    y_pred_proba = modelo.predict_proba(X_test_s)[:, 1]
    try:
        auc = roc_auc_score(y_test, y_pred_proba)
    except Exception:
        auc = 0.0

    importance = dict(zip(feature_cols, modelo.feature_importances_.tolist()))

    _modelo = modelo
    _scaler = scaler
    _feature_names = feature_cols
    _metricas_entrenamiento = {
        "auc": float(auc),
        "n_train": len(y_train),
        "n_test": len(y_test),
        "fecha": ahora.isoformat(),
    }

    return TrainingResponse(
        entrenado=True,
        auc_test=float(auc),
        n_train=len(y_train),
        n_test=len(y_test),
        n_clientes_total=len(datos["clientes"]),
        feature_importance=importance,
        fecha_entrenamiento=ahora.isoformat(),
    )

@router.get("/scores", response_model=List[ChurnScore])
def get_scores(limit: int = Query(default=100, le=500), min_risk: float = 0.0):
    """
    Devuelve scores de churn para todos los clientes activos.
    Si el modelo no está entrenado, lo entrena primero.
    """
    global _modelo, _scaler, _feature_names

    if _modelo is None:
        train_model()

    datos = _cargar_datos()
    ahora = datetime.utcnow()
    clientes_map = {c["id"]: c for c in datos["clientes"]}

    rows = []
    cliente_ids = []
    for c in datos["clientes"]:
        f = _construir_features(c["id"], ahora, datos)
        rows.append({k: v for k, v in f.items() if k != "dias_desde_ultima_compra"})
        cliente_ids.append((c["id"], c.get("nombre", "—"), f))

    df = pd.DataFrame(rows)
    if df.empty:
        return []

    X = df[_feature_names].values
    X_s = _scaler.transform(X)
    proba = _modelo.predict_proba(X_s)[:, 1]

    resultados = []
    for (cid, nombre, features), p in zip(cliente_ids, proba):
        if p < min_risk:
            continue
        resultados.append(ChurnScore(
            cliente_id=cid,
            cliente_nombre=nombre,
            probabilidad_churn=float(p),
            nivel_riesgo=nivel_riesgo(p),
            razon_principal=_explicacion_principal(features),
            features=features,
            fecha_calculo=ahora.isoformat(),
        ))

    resultados.sort(key=lambda r: r.probabilidad_churn, reverse=True)
    return resultados[:limit]

@router.get("/score/{cliente_id}", response_model=ChurnScore)
def get_score_cliente(cliente_id: str):
    """Score de churn de un cliente específico con sus features."""
    global _modelo, _scaler, _feature_names

    if _modelo is None:
        train_model()

    datos = _cargar_datos()
    cliente = next((c for c in datos["clientes"] if c["id"] == cliente_id), None)
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    ahora = datetime.utcnow()
    features = _construir_features(cliente_id, ahora, datos)
    f_input = {k: v for k, v in features.items() if k != "dias_desde_ultima_compra"}
    X = np.array([[f_input[fn] for fn in _feature_names]])
    X_s = _scaler.transform(X)
    p = float(_modelo.predict_proba(X_s)[0, 1])

    return ChurnScore(
        cliente_id=cliente_id,
        cliente_nombre=cliente.get("nombre", "—"),
        probabilidad_churn=p,
        nivel_riesgo=nivel_riesgo(p),
        razon_principal=_explicacion_principal(features),
        features=features,
        fecha_calculo=ahora.isoformat(),
    )

@router.get("/summary", response_model=ChurnSummary)
def get_summary():
    """Resumen agregado del estado de churn de toda la cartera."""
    scores = get_scores(limit=10000, min_risk=0.0)
    criticos = sum(1 for s in scores if s.nivel_riesgo == "critico")
    alto = sum(1 for s in scores if s.nivel_riesgo == "alto")
    medio = sum(1 for s in scores if s.nivel_riesgo == "medio")
    bajo = sum(1 for s in scores if s.nivel_riesgo == "bajo")
    return ChurnSummary(
        total_clientes=len(scores),
        criticos=criticos,
        alto_riesgo=alto,
        medio_riesgo=medio,
        bajo_riesgo=bajo,
        fecha_calculo=datetime.utcnow().isoformat(),
    )

@router.get("/health")
def health():
    return {
        "modelo_entrenado": _modelo is not None,
        "metricas": _metricas_entrenamiento,
    }
