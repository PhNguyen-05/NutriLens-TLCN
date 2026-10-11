"""
AI Service nhận diện món ăn (FastAPI) - dùng cho UC13.

Cần 2 file đặt cùng thư mục với main.py:
  best_model.pt   (tải từ Kaggle: effb3/best_model.pt)
  classes.json    (tạo bởi merge_datasets.py)

Chạy:
  pip install -r requirements.txt
  uvicorn main:app --host 127.0.0.1 --port 8000

Kiểm thử nhanh: mở http://127.0.0.1:8000/docs -> POST /predict -> Try it out.

Biến môi trường (không bắt buộc):
  MODEL_PATH, CLASSES_PATH, CONF_THRESHOLD (mặc định 0.30), MAX_IMAGE_MB (mặc định 5)
"""
import io
import json
import os
from pathlib import Path

import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision import models, transforms

BASE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE / "best_model.pt"))
CLASSES_PATH = Path(os.getenv("CLASSES_PATH", BASE / "classes.json"))
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.30"))  # UC13: dưới 30% = không nhận diện được
MAX_BYTES = int(os.getenv("MAX_IMAGE_MB", "5")) * 1024 * 1024  # UC13: tối đa 5MB
ALLOWED_TYPES = {"image/jpeg", "image/png"}                    # UC13: JPG/PNG
TOP_K = 3


def build_model(arch, num_classes):
    """Dựng lại đúng kiến trúc lúc huấn luyện (không cần tải trọng số ImageNet)."""
    m = models.get_model(arch, weights=None)
    if arch.startswith("efficientnet"):
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch == "convnext_tiny":
        m.classifier[2] = nn.Linear(m.classifier[2].in_features, num_classes)
    else:  # resnet50
        m.fc = nn.Linear(m.fc.in_features, num_classes)
    return m


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

ckpt = torch.load(MODEL_PATH, map_location=device)
classes = ckpt["classes"]
arch = ckpt["arch"]
size = ckpt["img_size"]

model = build_model(arch, len(classes))
model.load_state_dict(ckpt["model"])
model.to(device).eval()

meta = json.loads(CLASSES_PATH.read_text(encoding="utf-8"))
if [c["slug"] for c in meta] != classes:
    raise RuntimeError("Thứ tự lớp trong classes.json không khớp với best_model.pt. "
                       "Hãy dùng đúng classes.json được tạo cùng bộ dữ liệu đã train.")
names = {c["slug"]: c["name"] for c in meta}

# Tiền xử lý giống hệt tập val/test lúc huấn luyện
preprocess = transforms.Compose([
    transforms.Resize(int(size * 256 / 224)),
    transforms.CenterCrop(size),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

app = FastAPI(title="AI Service nhận diện món ăn")


@app.get("/health")
def health():
    return {"status": "ok", "model": arch, "img_size": size,
            "num_classes": len(classes), "device": str(device)}


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ chấp nhận ảnh JPG hoặc PNG")

    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413,
                            detail=f"Ảnh vượt quá {MAX_BYTES // (1024 * 1024)}MB")

    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")  # xoay đúng chiều ảnh chụp từ điện thoại
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="Ảnh không hợp lệ")

    x = preprocess(img).unsqueeze(0).to(device)
    with torch.inference_mode():
        probs = torch.softmax(model(x), dim=1)[0]
    conf, idx = probs.topk(TOP_K)

    predictions = [
        {"slug": classes[i], "name": names[classes[i]], "confidence": round(c * 100, 1)}
        for c, i in zip(conf.tolist(), idx.tolist())
    ]
    recognized = conf[0].item() >= CONF_THRESHOLD
    return {
        "recognized": recognized,
        "predictions": predictions,
        "message": None if recognized else "Không nhận diện được món ăn trong ảnh",
    }
