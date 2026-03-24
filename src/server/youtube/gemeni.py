# gemeni.py (OPTIMIZED VERSION)

import sys, io, os, json, re, warnings
from dotenv import load_dotenv
from google import genai

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

warnings.filterwarnings("ignore", category=FutureWarning)
load_dotenv()

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# ─────────────────────────────
# Utility
# ─────────────────────────────
def safe_extract_json(text: str):
    if not text or not text.strip():
        return None

    text = text.strip()

    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None

    try:
        return json.loads(match.group())
    except:
        return None


# ─────────────────────────────
# STEP 1: TEXT ONLY (เร็ว + ถูก)
# ─────────────────────────────
def analyze_text_only(title, description):
    prompt = f"""
    TITLE: {title}
    DESCRIPTION: {description}

    วิเคราะห์เฉพาะจากข้อความเท่านั้น

    กฎ:
    - ถ้ามี brand → ใส่ brand
    - ถ้ามีสินค้าแต่ไม่มี brand → brand = "No Brand"
    - ถ้าไม่มีอะไรเลย → ทุกค่า null

    category เลือก 1:
    Fashion, Beauty & Personal Care, Health & Wellness,
    Food & Beverage, Mom & Kids, IT & Gadgets,
    Home & Living, Toys & Collectibles, Pet,
    Automotive, Lifestyle

    ตอบ JSON เท่านั้น:
    {{"brand": null, "productType": null, "category": null}}
    """

    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return safe_extract_json(res.text)
    except:
        return None


# ─────────────────────────────
# STEP 2: VIDEO (fallback เท่านั้น)
# ─────────────────────────────
def analyze_video(url):
    try:
        res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "file_data": {
                        "file_uri": url,
                        "mime_type": "video/mp4"
                    }
                },
                """
                วิเคราะห์วิดีโอ หา brand / productType / category

                ถ้าไม่มี brand:
                - ให้ brand = "No Brand" ถ้ามีสินค้า
                - ถ้าไม่มีอะไรเลย → null

                ตอบ JSON:
                {"brand": null, "productType": null, "category": null}
                """
            ]
        )

        return safe_extract_json(res.text)
    except:
        return None


# ─────────────────────────────
# MAIN FUNCTION
# ─────────────────────────────
def analyze(url, title="None", description="None"):
    
    # ✅ STEP 1: TEXT ONLY
    data = analyze_text_only(title, description)

    if data and (data.get("brand") or data.get("productType")):
        return {
            "status": "success",
            "brand": data.get("brand"),
            "productType": data.get("productType"),
            "category": data.get("category"),
        }

    # ✅ STEP 2: VIDEO (เฉพาะจำเป็น)
    data = analyze_video(url)

    if not data:
        return {
            "status": "no_brand",
            "brand": None,
            "productType": None,
            "category": None
        }

    has_product = data.get("brand") or data.get("productType")

    return {
        "status": "success" if has_product else "no_brand",
        "brand": data.get("brand"),
        "productType": data.get("productType"),
        "category": data.get("category"),
    }


# ─────────────────────────────
# CLI (Node เรียก)
# ─────────────────────────────
if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    title = sys.argv[3] if len(sys.argv) > 3 else "None"
    description = sys.argv[4] if len(sys.argv) > 4 else "None"

    result = analyze(url, title, description)

    print(json.dumps(result, ensure_ascii=False))