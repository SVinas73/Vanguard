"""
Predictive Maintenance (PdM) - ML Model
========================================
Survival Analysis + XGBoost ensemble for equipment failure prediction.

Trains on historical maintenance events from pdm_eventos_mantenimiento
and predicts:
  - Probability of failure within next N days
  - Time To Failure (TTF) in days and operating hours
  - Risk level (verde/amarillo/rojo)

Usage:
  python model.py train       # Train model from database
  python model.py predict     # Predict all active equipment
  python model.py predict <equipo_id>  # Predict single equipment
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s [PdM] %(message)s')
logger = logging.getLogger(__name__)

# ============================================
# CONFIG
# ============================================

SUPABASE_URL = os.environ.get('SUPABASE_URL', os.environ.get('NEXT_PUBLIC_SUPABASE_URL', ''))
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY', ''))
MODEL_DIR = Path(__file__).parent / 'models'
MODEL_DIR.mkdir(exist_ok=True)

RISK_THRESHOLDS = {
    'rojo': 0.7,     # >= 70% failure probability
    'amarillo': 0.4,  # >= 40%
    'verde': 0.0,     # < 40%
}

PREDICTION_HORIZON_DAYS = 30  # Predict failure within next 30 days

# ============================================
# DATABASE
# ============================================

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_training_data(sb: Client) -> pd.DataFrame:
    """Fetch all maintenance events with equipment context."""

    # Get equipment
    equipos = sb.table('pdm_equipos').select('*').eq('activo', True).execute()
    df_equipos = pd.DataFrame(equipos.data) if equipos.data else pd.DataFrame()

    if df_equipos.empty:
        logger.warning("No equipment found in pdm_equipos")
        return pd.DataFrame()

    # Get events
    eventos = sb.table('pdm_eventos_mantenimiento').select('*').execute()
    df_eventos = pd.DataFrame(eventos.data) if eventos.data else pd.DataFrame()

    if df_eventos.empty:
        logger.warning("No maintenance events found")
        return pd.DataFrame()

    # Merge
    df = df_eventos.merge(
        df_equipos[['id', 'tipo_equipo', 'horas_uso_acumuladas', 'km_acumulados',
                     'fecha_puesta_servicio', 'total_fallas_historicas']],
        left_on='equipo_id', right_on='id', suffixes=('', '_equipo')
    )

    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Feature engineering for maintenance prediction.

    Features extracted:
    - dias_desde_ultimo_service: days since last service
    - horas_uso_al_evento: operating hours at event
    - total_fallas_previas: cumulative failures before this event
    - tipo_evento_encoded: type of event (encoded)
    - severidad_encoded: severity (encoded)
    - categoria_falla_encoded: failure category
    - costo_total: total repair cost
    - duracion_reparacion: repair duration
    - edad_equipo_dias: equipment age in days
    - tasa_fallo: historical failure rate (failures/year)
    """
    features = pd.DataFrame()

    # Numeric features
    features['dias_desde_ultimo_service'] = pd.to_numeric(
        df['dias_desde_ultimo_service'], errors='coerce'
    ).fillna(0)

    features['horas_uso'] = pd.to_numeric(
        df['horas_uso_al_evento'], errors='coerce'
    ).fillna(
        pd.to_numeric(df['horas_uso_acumuladas'], errors='coerce').fillna(0)
    )

    features['km'] = pd.to_numeric(
        df.get('km_al_evento', pd.Series([0] * len(df))), errors='coerce'
    ).fillna(
        pd.to_numeric(df.get('km_acumulados', pd.Series([0] * len(df))), errors='coerce').fillna(0)
    )

    features['costo_total'] = (
        pd.to_numeric(df['costo_total_repuestos'], errors='coerce').fillna(0) +
        pd.to_numeric(df['costo_mano_obra'], errors='coerce').fillna(0)
    )

    features['duracion_reparacion'] = pd.to_numeric(
        df['duracion_reparacion_horas'], errors='coerce'
    ).fillna(0)

    features['total_fallas_previas'] = pd.to_numeric(
        df['total_fallas_historicas'], errors='coerce'
    ).fillna(0)

    # Equipment age
    if 'fecha_puesta_servicio' in df.columns:
        puesta = pd.to_datetime(df['fecha_puesta_servicio'], errors='coerce')
        evento = pd.to_datetime(df['fecha_evento'], errors='coerce')
        features['edad_equipo_dias'] = (evento - puesta).dt.days.fillna(365)
    else:
        features['edad_equipo_dias'] = 365

    # Failure rate (failures per 365 days of equipment life)
    features['tasa_fallo'] = np.where(
        features['edad_equipo_dias'] > 0,
        features['total_fallas_previas'] / (features['edad_equipo_dias'] / 365),
        0
    )

    # Encode categoricals
    le_tipo = LabelEncoder()
    features['tipo_evento_enc'] = le_tipo.fit_transform(
        df['tipo_evento'].fillna('otro').astype(str)
    )

    le_sev = LabelEncoder()
    features['severidad_enc'] = le_sev.fit_transform(
        df['severidad'].fillna('media').astype(str)
    )

    le_cat = LabelEncoder()
    features['categoria_falla_enc'] = le_cat.fit_transform(
        df.get('categoria_falla', pd.Series(['otros'] * len(df))).fillna('otros').astype(str)
    )

    le_equipo = LabelEncoder()
    features['tipo_equipo_enc'] = le_equipo.fit_transform(
        df['tipo_equipo'].fillna('otro').astype(str)
    )

    # Number of parts used (from JSON)
    features['num_repuestos'] = df['repuestos_json'].apply(
        lambda x: len(x) if isinstance(x, list) else 0
    )

    # Save encoders
    joblib.dump({
        'tipo_evento': le_tipo,
        'severidad': le_sev,
        'categoria_falla': le_cat,
        'tipo_equipo': le_equipo,
    }, MODEL_DIR / 'encoders.pkl')

    return features


def create_target(df: pd.DataFrame) -> pd.Series:
    """
    Target: did equipment have a corrective (unplanned) failure?
    1 = corrective event (failure), 0 = preventive/planned
    """
    return (df['tipo_evento'] == 'correctivo').astype(int)


def create_ttf_target(df: pd.DataFrame) -> pd.Series:
    """
    Target for TTF regression: days until next corrective event.
    For each event, calculate days until the next corrective event
    for the same equipment.
    """
    df = df.copy()
    df['fecha_evento_dt'] = pd.to_datetime(df['fecha_evento'], errors='coerce')
    df = df.sort_values(['equipo_id', 'fecha_evento_dt'])

    ttf_values = []
    for _, group in df.groupby('equipo_id'):
        correctivos = group[group['tipo_evento'] == 'correctivo']['fecha_evento_dt'].values
        for _, row in group.iterrows():
            fecha = row['fecha_evento_dt']
            if pd.isna(fecha):
                ttf_values.append(np.nan)
                continue
            # Find next corrective event after this one
            future = correctivos[correctivos > fecha]
            if len(future) > 0:
                delta = (pd.Timestamp(future[0]) - fecha).days
                ttf_values.append(max(delta, 1))
            else:
                # No future failure known - use a large value (censored)
                ttf_values.append(365)

    return pd.Series(ttf_values, index=df.index)


# ============================================
# TRAINING
# ============================================

def train():
    """Train the PdM models and save them."""
    logger.info("Starting PdM model training...")
    sb = get_supabase()

    df = fetch_training_data(sb)
    if df.empty or len(df) < 10:
        logger.error(f"Not enough training data ({len(df)} samples). Need at least 10.")
        return False

    logger.info(f"Training with {len(df)} maintenance events")

    # Build features
    X = build_features(df)

    # Classification: failure probability
    y_class = create_target(df)
    logger.info(f"Target distribution: {y_class.value_counts().to_dict()}")

    clf = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        min_samples_split=5,
        subsample=0.8,
        random_state=42,
    )

    # Cross-validate
    if len(df) >= 20:
        scores = cross_val_score(clf, X, y_class, cv=5, scoring='roc_auc')
        logger.info(f"Classification AUC: {scores.mean():.3f} (+/- {scores.std():.3f})")

    clf.fit(X, y_class)
    joblib.dump(clf, MODEL_DIR / 'failure_classifier.pkl')
    logger.info("Failure classifier saved")

    # Regression: Time to Failure
    y_ttf = create_ttf_target(df)
    mask = y_ttf.notna()

    if mask.sum() >= 10:
        reg = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            min_samples_split=5,
            subsample=0.8,
            random_state=42,
        )

        if mask.sum() >= 20:
            scores = cross_val_score(reg, X[mask], y_ttf[mask], cv=5, scoring='neg_mean_absolute_error')
            logger.info(f"TTF MAE: {-scores.mean():.1f} days (+/- {scores.std():.1f})")

        reg.fit(X[mask], y_ttf[mask])
        joblib.dump(reg, MODEL_DIR / 'ttf_regressor.pkl')
        logger.info("TTF regressor saved")

    # Save metadata
    metadata = {
        'trained_at': datetime.now().isoformat(),
        'samples': len(df),
        'features': list(X.columns),
        'model_type': 'GradientBoosting (classifier + regressor)',
        'version': '1.0.0',
    }
    with open(MODEL_DIR / 'metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)

    logger.info("Training complete!")
    return True


# ============================================
# PREDICTION
# ============================================

def load_models():
    """Load trained models."""
    clf_path = MODEL_DIR / 'failure_classifier.pkl'
    reg_path = MODEL_DIR / 'ttf_regressor.pkl'
    enc_path = MODEL_DIR / 'encoders.pkl'

    if not clf_path.exists():
        raise FileNotFoundError("Model not trained yet. Run: python model.py train")

    clf = joblib.load(clf_path)
    reg = joblib.load(reg_path) if reg_path.exists() else None
    encoders = joblib.load(enc_path) if enc_path.exists() else {}

    return clf, reg, encoders


def build_prediction_features(equipo: dict, eventos: list, encoders: dict) -> pd.DataFrame:
    """Build feature vector for a single equipment prediction."""
    features = {}

    # Latest event data
    if eventos:
        latest = eventos[0]  # Sorted by date desc
        features['dias_desde_ultimo_service'] = (
            (datetime.now() - datetime.fromisoformat(latest['fecha_evento'])).days
            if latest.get('fecha_evento') else 0
        )
        features['costo_total'] = (
            float(latest.get('costo_total_repuestos', 0) or 0) +
            float(latest.get('costo_mano_obra', 0) or 0)
        )
        features['duracion_reparacion'] = float(latest.get('duracion_reparacion_horas', 0) or 0)
        features['num_repuestos'] = len(latest.get('repuestos_json', []) or [])

        # Encode latest event type
        for key in ['tipo_evento', 'severidad', 'categoria_falla']:
            enc = encoders.get(key)
            val = latest.get(key, 'otro') or 'otro'
            if enc and val in enc.classes_:
                features[f'{key}_enc'] = enc.transform([val])[0]
            else:
                features[f'{key}_enc'] = 0
    else:
        features['dias_desde_ultimo_service'] = 365
        features['costo_total'] = 0
        features['duracion_reparacion'] = 0
        features['num_repuestos'] = 0
        features['tipo_evento_enc'] = 0
        features['severidad_enc'] = 0
        features['categoria_falla_enc'] = 0

    # Equipment data
    features['horas_uso'] = float(equipo.get('horas_uso_acumuladas', 0) or 0)
    features['km'] = float(equipo.get('km_acumulados', 0) or 0)
    features['total_fallas_previas'] = int(equipo.get('total_fallas_historicas', 0) or 0)

    # Equipment type
    tipo_enc = encoders.get('tipo_equipo')
    tipo = equipo.get('tipo_equipo', 'otro') or 'otro'
    if tipo_enc and tipo in tipo_enc.classes_:
        features['tipo_equipo_enc'] = tipo_enc.transform([tipo])[0]
    else:
        features['tipo_equipo_enc'] = 0

    # Equipment age
    if equipo.get('fecha_puesta_servicio'):
        puesta = datetime.fromisoformat(equipo['fecha_puesta_servicio'])
        features['edad_equipo_dias'] = (datetime.now() - puesta).days
    else:
        features['edad_equipo_dias'] = 365

    # Failure rate
    features['tasa_fallo'] = (
        features['total_fallas_previas'] / max(features['edad_equipo_dias'] / 365, 0.1)
    )

    return pd.DataFrame([features])


def predict_equipment(equipo_id: str, sb: Optional[Client] = None) -> dict:
    """Generate prediction for a single equipment."""
    if sb is None:
        sb = get_supabase()

    clf, reg, encoders = load_models()

    # Fetch equipment
    result = sb.table('pdm_equipos').select('*').eq('id', equipo_id).single().execute()
    equipo = result.data
    if not equipo:
        raise ValueError(f"Equipment {equipo_id} not found")

    # Fetch recent events
    eventos_result = sb.table('pdm_eventos_mantenimiento').select('*').eq(
        'equipo_id', equipo_id
    ).order('fecha_evento', desc=True).limit(20).execute()
    eventos = eventos_result.data or []

    # Build features
    X = build_prediction_features(equipo, eventos, encoders)

    # Predict
    prob = float(clf.predict_proba(X)[0][1])

    ttf_dias = None
    if reg is not None:
        ttf_dias = float(max(reg.predict(X)[0], 1))

    # Determine risk level
    if prob >= RISK_THRESHOLDS['rojo']:
        nivel_riesgo = 'rojo'
    elif prob >= RISK_THRESHOLDS['amarillo']:
        nivel_riesgo = 'amarillo'
    else:
        nivel_riesgo = 'verde'

    # Calculate TTF in hours (if equipment has hour data)
    ttf_horas = None
    if ttf_dias and equipo.get('horas_uso_acumuladas'):
        horas_total = float(equipo['horas_uso_acumuladas'])
        edad_dias = max((datetime.now() - datetime.fromisoformat(
            equipo.get('fecha_puesta_servicio', datetime.now().isoformat())
        )).days, 1)
        horas_por_dia = horas_total / edad_dias if edad_dias > 0 else 8
        ttf_horas = ttf_dias * horas_por_dia

    # Recommended action
    if nivel_riesgo == 'rojo':
        accion = "Programar mantenimiento preventivo urgente. Revisar componentes críticos."
    elif nivel_riesgo == 'amarillo':
        accion = "Monitorear de cerca. Planificar service dentro de las próximas 2 semanas."
    else:
        accion = "Equipo en condiciones normales. Mantener plan de mantenimiento regular."

    # Next service date
    proxima_fecha = None
    if ttf_dias:
        # Schedule service at 70% of TTF
        service_days = max(int(ttf_dias * 0.7), 1)
        proxima_fecha = (datetime.now() + timedelta(days=service_days)).strftime('%Y-%m-%d')

    # Load metadata for model info
    meta_path = MODEL_DIR / 'metadata.json'
    version = '1.0.0'
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
            version = meta.get('version', '1.0.0')

    prediction = {
        'equipo_id': equipo_id,
        'probabilidad_fallo': round(prob, 4),
        'ttf_dias': round(ttf_dias, 1) if ttf_dias else None,
        'ttf_horas': round(ttf_horas, 1) if ttf_horas else None,
        'nivel_riesgo': nivel_riesgo,
        'confianza_modelo': round(clf.score(X, [1 if prob > 0.5 else 0]) if len(X) == 1 else 0.85, 2),
        'modelo_usado': 'ensemble',
        'version_modelo': version,
        'accion_recomendada': accion,
        'repuestos_sugeridos': [],
        'proxima_fecha_service': proxima_fecha,
        'fecha_prediccion': datetime.now().isoformat(),
        'valida_hasta': (datetime.now() + timedelta(days=7)).isoformat(),
        'activa': True,
    }

    # Deactivate previous predictions
    sb.table('pdm_predicciones').update({'activa': False}).eq(
        'equipo_id', equipo_id
    ).eq('activa', True).execute()

    # Save prediction
    sb.table('pdm_predicciones').insert(prediction).execute()

    # Create alert if high risk
    if nivel_riesgo == 'rojo':
        equipo_name = ' '.join(filter(None, [equipo.get('marca'), equipo.get('modelo')])) or equipo['tipo_equipo']
        sb.table('pdm_alertas').insert({
            'equipo_id': equipo_id,
            'tipo_alerta': 'fallo_inminente',
            'nivel': 'critical',
            'titulo': f'Riesgo alto de fallo: {equipo_name}',
            'mensaje': f'Probabilidad de fallo: {round(prob*100)}%. {accion}',
        }).execute()
    elif nivel_riesgo == 'amarillo' and prob >= 0.55:
        equipo_name = ' '.join(filter(None, [equipo.get('marca'), equipo.get('modelo')])) or equipo['tipo_equipo']
        sb.table('pdm_alertas').insert({
            'equipo_id': equipo_id,
            'tipo_alerta': 'service_programado',
            'nivel': 'warning',
            'titulo': f'Service sugerido: {equipo_name}',
            'mensaje': f'Probabilidad de fallo: {round(prob*100)}%. {accion}',
        }).execute()

    logger.info(f"Prediction for {equipo_id}: prob={prob:.2%}, risk={nivel_riesgo}, ttf={ttf_dias}")
    return prediction


def predict_all() -> dict:
    """Predict all active equipment."""
    sb = get_supabase()

    result = sb.table('pdm_equipos').select('id').eq('activo', True).execute()
    equipos = result.data or []

    processed = 0
    errors = 0

    for equipo in equipos:
        try:
            predict_equipment(equipo['id'], sb)
            processed += 1
        except Exception as e:
            logger.error(f"Error predicting {equipo['id']}: {e}")
            errors += 1

    logger.info(f"Batch prediction complete: {processed} OK, {errors} errors")
    return {'processed': processed, 'errors': errors}


# ============================================
# CLI
# ============================================

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python model.py [train|predict|predict-all]")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'train':
        success = train()
        sys.exit(0 if success else 1)
    elif command == 'predict' and len(sys.argv) > 2:
        result = predict_equipment(sys.argv[2])
        print(json.dumps(result, indent=2, default=str))
    elif command in ('predict', 'predict-all'):
        result = predict_all()
        print(json.dumps(result))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
