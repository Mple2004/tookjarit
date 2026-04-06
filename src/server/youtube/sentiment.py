import sys, json, io, warnings

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
warnings.filterwarnings("ignore")

MODEL_NAME = "ZombitX64/MultiSent-E5-Pro"

LABEL_MAP = {
    "LABEL_0": "Neutral",  # เปลี่ยนจาก Question เป็น Neutral
    "LABEL_1": "Negative",
    "LABEL_2": "Neutral",  
    "LABEL_3": "Positive"  
}

try:
    from transformers import pipeline
    classifier = pipeline("sentiment-analysis", model=MODEL_NAME, tokenizer=MODEL_NAME)
except Exception as e:
    print(json.dumps({"status": "error", "message": f"Model load failed: {str(e)}"}), flush=True)
    sys.exit(1)


def chunk_text(text: str, max_chars: int = 400) -> list:
    """ตัดข้อความที่ยาวเกิน 400 ตัวอักษรออกเป็น chunk"""
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks = []
    while len(text) > max_chars:
        cut = text.rfind(" ", 0, max_chars)
        if cut == -1:
            cut = max_chars
        chunks.append(text[:cut].strip())
        text = text[cut:].strip()
    if text:
        chunks.append(text)
    return chunks


def analyze_single(text: str) -> dict:
    if not text or not text.strip():
        return {"sentiment": None, "confidence": None, "status": "empty"}

    chunks = chunk_text(text)
    if not chunks:
        return {"sentiment": None, "confidence": None, "status": "empty"}

    try:
        results = classifier(chunks)
    except Exception as e:
        return {"sentiment": None, "confidence": None, "status": "error", "message": str(e)}

    label_scores: dict = {}
    for r in results:
        lbl = r["label"]
        mapped_label = LABEL_MAP.get(lbl, lbl)
        label_scores.setdefault(mapped_label, []).append(r["score"])

    avg_scores = {lbl: sum(scores) / len(scores) for lbl, scores in label_scores.items()}
    best_label = max(avg_scores, key=avg_scores.get)
    best_score = avg_scores[best_label]

    return {
        "status": "success",
        "sentiment": best_label,        # POSITIVE / NEUTRAL / NEGATIVE
        "confidence": round(best_score, 4),
    }


# ปรับส่วนรับ Input ให้รับเป็น List ของ JSON
if __name__ == "__main__":
    input_data = json.loads(sys.argv[1]) # รับเป็น ["text1", "text2", ...]
    results = [analyze_single(t) for t in input_data]
    print(json.dumps(results, ensure_ascii=False))