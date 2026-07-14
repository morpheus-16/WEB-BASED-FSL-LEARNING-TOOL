# landmark_utils.py
"""
Shared landmark normalization for the static-sign + LSTM pipeline.

Raw MediaPipe landmarks are in frame-relative coordinates (0-1 range tied
to where the hand sits in the camera frame and how far it is from the
camera). Feeding those raw values into a classifier means the model
partly learns "position in frame" / "distance from camera" instead of
hand shape, which hurts real-world accuracy.

This module makes landmarks:
  - Translation-invariant: re-centered on the wrist (landmark 0)
  - Scale-invariant: divided by a stable reference distance
    (wrist -> middle-finger MCP, landmark 9)

IMPORTANT: This exact function must be used at collection time AND at
inference time. If you change it, you must recollect data and retrain.
"""

import numpy as np


def normalize_landmarks(landmarks_flat: np.ndarray) -> np.ndarray:
    """
    landmarks_flat: flat array of 63 floats (21 landmarks x [x, y, z])
    returns: flat array of 63 floats, translation + scale invariant
    """
    pts = np.asarray(landmarks_flat, dtype=np.float32).reshape(21, 3).copy()

    # Translation invariance: re-center on wrist
    wrist = pts[0].copy()
    pts -= wrist

    # Scale invariance: normalize by wrist -> middle finger MCP distance
    scale = np.linalg.norm(pts[9])
    if scale < 1e-6:
        scale = 1e-6
    pts /= scale

    return pts.flatten().astype(np.float32)