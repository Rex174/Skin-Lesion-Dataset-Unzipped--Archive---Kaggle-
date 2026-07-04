"""
===================================================================================
FYP - PHASE 2: HMS Backend
ml/predict.py  -  Melanoma prediction engine
TP070818 | Ramaneiss Pillai S Gopalan

Loads the trained CNN models from Phase 1 and exposes a single predict()
function used by both the Patient and Doctor routes.
===================================================================================
"""

import json
import numpy as np
from pathlib import Path
from PIL import Image

# Lazy-load TensorFlow to keep startup fast
_models = {}   # cache: {"baseline": model, "enhanced_v2": model}
_label_map = None


# ── RARE SUBGROUP DETECTION ─────────────────────────────────────────────────────
# Subgroups with < 30 training samples in HAM10000 (from Phase 1 Step 1)
# Used to generate fairness notes on predictions
RARE_SUBGROUPS = {
    # Format: (age_group, sex, loc_zone)
    ("Pediatric", "male",   "Trunk"),
    ("Pediatric", "male",   "LowerExtremity"),
    ("Pediatric", "female", "Trunk"),
    ("Pediatric", "female", "UpperExtremity"),
    ("Pediatric", "female", "Head"),
    ("Pediatric", "male",   "Head"),
    ("YoungAdult","male",   "Unknown"),
    ("YoungAdult","female", "Unknown"),
    ("Elderly",   "male",   "Unknown"),
    ("Elderly",   "female", "Unknown"),
}

IMG_SIZE = (224, 224)


def _get_loc_zone(localization: str) -> str:
    """Map raw HAM10000 localization string to simplified zone."""
    zone_map = {
        "back": "Trunk", "trunk": "Trunk", "abdomen": "Trunk",
        "chest": "Trunk", "genital": "Trunk",
        "face": "Head", "neck": "Head", "scalp": "Head", "ear": "Head",
        "lower extremity": "LowerExtremity", "foot": "LowerExtremity",
        "acral": "LowerExtremity",
        "upper extremity": "UpperExtremity", "hand": "UpperExtremity",
        "unknown": "Unknown",
    }
    return zone_map.get(str(localization).lower().strip(), "Other")


def load_model(model_key: str, model_path: str):
    """Load and cache a Keras model. model_key: 'baseline' | 'enhanced_v2'"""
    global _models
    if model_key not in _models:
        try:
            from tensorflow import keras 
            _models[model_key] = keras.models.load_model(model_path)
            print(f"[OK] Model loaded: {model_key} from {model_path}")
        except Exception as e:
            print(f"[ERROR] Could not load model '{model_key}': {e}")
            _models[model_key] = None
    return _models[model_key]


def _load_label_map(label_map_path: str) -> dict:
    global _label_map
    if _label_map is None:
        with open(label_map_path, "r") as f:
            _label_map = json.load(f)
    return _label_map


def preprocess_image(image_path: str) -> np.ndarray:
    """
    Load an image from disk and preprocess it for EfficientNet-B0.
    IMPORTANT: Do NOT divide by 255. EfficientNetB0(weights="imagenet")
    normalises [0,255] inputs internally. This must match the exact
    preprocessing used during training (Cell 4 / Cell 9 of Phase 3 notebook).
    """
    img = Image.open(image_path).convert("RGB")
    img = img.resize(IMG_SIZE, Image.BILINEAR)
    arr = np.array(img, dtype=np.float32)   # ← [0, 255] — NO /255.0
    return np.expand_dims(arr, axis=0)      # (1, 224, 224, 3)


def predict(
    image_path: str,
    model_key: str,
    model_path: str,
    label_map_path: str,
    class_labels: dict,
    class_risk: dict,
    patient_age_group: str = None,
    patient_sex: str = None,
    patient_localization: str = None,
) -> dict:
    """
    Run melanoma prediction on a single image.

    Returns a dict:
    {
        "predicted_class":   "mel",
        "predicted_label":   "Melanoma",
        "confidence_score":  0.87,
        "risk_level":        "high",
        "all_probabilities": {"mel": 0.87, "nv": 0.09, ...},
        "top3":              [("mel", 0.87), ("nv", 0.09), ("bcc", 0.02)],
        "fairness_note":     "..." or None,
        "model_used":        "enhanced_v2",
        "error":             None or error string,
    }
    """
    result = {
        "predicted_class":   None,
        "predicted_label":   None,
        "confidence_score":  None,
        "risk_level":        None,
        "all_probabilities": {},
        "top3":              [],
        "fairness_note":     None,
        "model_used":        model_key,
        "error":             None,
    }

    # ── Load model ─────────────────────────────────────────────────────────────
    model = load_model(model_key, model_path)
    if model is None:
        result["error"] = (
            f"Model '{model_key}' could not be loaded. "
            "Please ensure Phase 1 training is complete and model paths are correct in config.py."
        )
        return result

    # ── Load label map ─────────────────────────────────────────────────────────
    label_map = _load_label_map(label_map_path)
    idx_to_class = {v: k for k, v in label_map.items()}

    # ── Preprocess image ───────────────────────────────────────────────────────
    try:
        img_array = preprocess_image(image_path)
    except Exception as e:
        result["error"] = f"Image preprocessing failed: {e}"
        return result

    # ── Inference ──────────────────────────────────────────────────────────────
    try:
        probs = model.predict(img_array, verbose=0)[0]   # shape: (7,)
    except Exception as e:
        result["error"] = f"Model inference failed: {e}"
        return result

    # ── Parse results ──────────────────────────────────────────────────────────
    pred_idx   = int(np.argmax(probs))
    pred_class = idx_to_class[pred_idx]
    confidence = float(probs[pred_idx])

    all_probs = {
        idx_to_class[i]: float(probs[i])
        for i in range(len(probs))
    }

    # Top 3 predictions
    sorted_probs = sorted(all_probs.items(), key=lambda x: x[1], reverse=True)
    top3 = [(cls, round(prob * 100, 1)) for cls, prob in sorted_probs[:3]]

    result.update({
        "predicted_class":   pred_class,
        "predicted_label":   class_labels.get(pred_class, pred_class),
        "confidence_score":  round(confidence, 4),
        "risk_level":        class_risk.get(pred_class, "unknown"),
        "all_probabilities": {k: round(v * 100, 2) for k, v in all_probs.items()},
        "top3":              top3,
    })

    # ── Fairness note for underrepresented subgroups ───────────────────────────
    if patient_age_group and patient_sex and patient_localization:
        loc_zone = _get_loc_zone(patient_localization)
        subgroup = (patient_age_group, patient_sex.lower(), loc_zone)
        if subgroup in RARE_SUBGROUPS:
            note = (
                f"This patient belongs to a historically underrepresented demographic "
                f"subgroup ({patient_age_group}, {patient_sex}, {loc_zone} lesion). "
                f"The Enhanced Model (v2) was specifically trained with synthetic augmentation "
                f"for this subgroup to improve prediction fairness."
            )
            if model_key == "baseline":
                note += (
                    " Consider re-running with the Enhanced Model for a more equitable result."
                )
            result["fairness_note"] = note

    return result
