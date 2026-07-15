"""
Alphabet recognition using the existing Random Forest model.
Expects normalized 63-dim MediaPipe landmarks (same as training).
"""

from pathlib import Path
from typing import Optional, Dict, Any

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

_model = None
_encoder = None
_loaded = False


def _load_models():
    global _model, _encoder, _loaded
    if _loaded:
        return
    
    # Lazy import to save startup memory
    import joblib

    model_path = MODELS_DIR / "random_forest_model.pkl"
    enc_path = MODELS_DIR / "random_forest_encoder.pkl"
    if not model_path.exists() or not enc_path.exists():
        print(f"[recognizer] Models not found in {MODELS_DIR}")
        _loaded = True
        return
    try:
        _model = joblib.load(model_path)
        _encoder = joblib.load(enc_path)
        print(f"[recognizer] Loaded RF model. Classes: {list(_encoder.classes_)}")
    except Exception as e:
        print(f"[recognizer] Failed to load models: {e}")
    _loaded = True


def normalize_landmarks(landmarks_flat) -> Any:
    """
    Same normalization used during training:
    - re-center on wrist (lm 0)
    - scale by wrist -> middle MCP (lm 9)
    """
    import numpy as np

    pts = np.asarray(landmarks_flat, dtype=np.float32).reshape(21, 3).copy()
    wrist = pts[0].copy()
    pts -= wrist
    scale = np.linalg.norm(pts[9])
    if scale < 1e-6:
        scale = 1e-6
    pts /= scale
    return pts.flatten().astype(np.float32)


def predict_letter(landmarks: list) -> Dict[str, Any]:
    """
    landmarks: list of 63 floats (or nested) from MediaPipe.
    Returns { letter, confidence, all_probs (top 5) }
    """
    import numpy as np

    _load_models()
    if _model is None or _encoder is None:
        return {
            "letter": "?",
            "confidence": 0.0,
            "message": "Model not loaded",
            "top": [],
        }

    try:
        arr = np.asarray(landmarks, dtype=np.float32).flatten()
        if arr.shape[0] != 63:
            return {
                "letter": "?",
                "confidence": 0.0,
                "message": f"Expected 63 features, got {arr.shape[0]}",
                "top": [],
            }

        # If values look like raw 0-1, normalize; if already centered they still benefit
        # from the same function (idempotent enough for demo).
        features = normalize_landmarks(arr).reshape(1, -1)

        proba = _model.predict_proba(features)[0]
        pred_idx = int(np.argmax(proba))
        letter = str(_encoder.inverse_transform([pred_idx])[0])
        conf = float(proba[pred_idx])

        # top 5
        top_idx = np.argsort(proba)[::-1][:5]
        top = [
            {"letter": str(_encoder.inverse_transform([i])[0]), "confidence": float(proba[i])}
            for i in top_idx
        ]

        return {
            "letter": letter,
            "confidence": conf,
            "message": "ok",
            "top": top,
        }
    except Exception as e:
        return {
            "letter": "?",
            "confidence": 0.0,
            "message": str(e),
            "top": [],
        }

