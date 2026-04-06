import json, warnings
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline
import uvicorn

# ปิด warning ที่ไม่จำเป็น
warnings.filterwarnings("ignore")

app = FastAPI()

MODEL_NAME = "ZombitX64/MultiSent-E5-Pro"
LABEL_MAP = {
    "LABEL_0": "Neutral",
    "LABEL_1": "Negative",
    "LABEL_2": "Neutral",  
    "LABEL_3": "Positive"  
}

print("⌛ กำลังโหลด Model (2.24GB)... กรุณารอสักครู่")
try:
    # โหลดโมเดลค้างไว้ใน RAM เพียงครั้งเดียว
    classifier = pipeline("sentiment-analysis", model=MODEL_NAME, tokenizer=MODEL_NAME)
    print("✅ โหลดโมเดลสำเร็จ! Server พร้อมใช้งานที่ http://127.0.0.1:8000")
except Exception as e:
    print(f"❌ เกิดข้อผิดพลาดในการโหลดโมเดล: {e}")

class TextRequest(BaseModel):
    text: str

def chunk_text(text: str, max_chars: int = 400) -> list:
    text = text.strip()
    if not text or len(text) <= max_chars:
        return [text] if text else []
    chunks = []
    while len(text) > max_chars:
        cut = text.rfind(" ", 0, max_chars)
        if cut == -1: cut = max_chars
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()
    if text: chunks.append(text)
    return chunks

@app.post("/analyze")
async def analyze(request: TextRequest):
    text = request.text
    if not text.strip():
        return {"status": "empty", "sentiment": None, "confidence": None}

    chunks = chunk_text(text)
    try:
        results = classifier(chunks)
        label_scores = {}
        for r in results:
            lbl = r["label"]
            # แปลง Label และทำให้เป็นตัวพิมพ์ใหญ่ตามมาตรฐานของระบบคุณ
            mapped_label = LABEL_MAP.get(lbl, lbl).upper() 
            label_scores.setdefault(mapped_label, []).append(r["score"])

        # หาค่าเฉลี่ยคะแนน
        avg_scores = {lbl: sum(scores) / len(scores) for lbl, scores in label_scores.items()}
        best_label = max(avg_scores, key=avg_scores.get)
        
        return {
            "status": "success",
            "sentiment": best_label,
            "confidence": round(avg_scores[best_label], 4)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)