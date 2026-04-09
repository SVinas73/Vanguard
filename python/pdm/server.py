"""
Predictive Maintenance (PdM) - REST API Server
================================================
FastAPI backend that serves predictions and manages model training.

Endpoints:
  GET  /api/pdm/health               - Health check
  POST /api/pdm/predict/{equipo_id}  - Predict single equipment
  POST /api/pdm/predict-all          - Batch predict all equipment
  GET  /api/pdm/model/status         - Model training status
  POST /api/pdm/model/retrain        - Trigger model retraining

Run:
  uvicorn server:app --host 0.0.0.0 --port 8000
"""

import json
import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model import (
    train,
    predict_equipment,
    predict_all,
    load_models,
    MODEL_DIR,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vanguard PdM AI Service",
    description="Predictive Maintenance engine for workshop equipment",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# ENDPOINTS
# ============================================

@app.get("/api/pdm/health")
async def health():
    """Health check - returns OK if service is running and model is loaded."""
    model_exists = (MODEL_DIR / 'failure_classifier.pkl').exists()
    return {
        "status": "ok",
        "model_loaded": model_exists,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/pdm/predict/{equipo_id}")
async def predict_single(equipo_id: str):
    """Generate failure prediction for a single equipment."""
    try:
        result = predict_equipment(equipo_id)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pdm/predict-all")
async def predict_batch():
    """Run predictions for all active equipment."""
    try:
        result = predict_all()
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Batch prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pdm/model/status")
async def model_status():
    """Get current model training status."""
    meta_path = MODEL_DIR / 'metadata.json'

    if not meta_path.exists():
        return {
            "trained": False,
            "last_trained": None,
            "samples": 0,
            "accuracy": None,
            "model_type": "GradientBoosting (not trained)",
        }

    with open(meta_path) as f:
        meta = json.load(f)

    return {
        "trained": True,
        "last_trained": meta.get('trained_at'),
        "samples": meta.get('samples', 0),
        "accuracy": None,  # Computed during training
        "model_type": meta.get('model_type', 'unknown'),
        "version": meta.get('version', '1.0.0'),
        "features": meta.get('features', []),
    }


@app.post("/api/pdm/model/retrain")
async def retrain():
    """Trigger model retraining from latest data."""
    try:
        success = train()
        if success:
            return {"success": True, "message": "Model retrained successfully"}
        else:
            return {"success": False, "message": "Not enough training data"}
    except Exception as e:
        logger.error(f"Retrain error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STARTUP
# ============================================

@app.on_event("startup")
async def startup():
    logger.info("PdM AI Service starting...")
    if (MODEL_DIR / 'failure_classifier.pkl').exists():
        try:
            load_models()
            logger.info("Models loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load models: {e}")
    else:
        logger.info("No trained model found. Train with POST /api/pdm/model/retrain")
