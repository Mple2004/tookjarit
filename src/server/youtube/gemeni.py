# gemeni.py (OPTIMIZED VERSION)

import sys, io, os, json, re, warnings
from dotenv import load_dotenv
from google import genai

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

warnings.filterwarnings("ignore", category=FutureWarning)
load_dotenv()

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def normalize_brand(brand: str) -> str:
    if not brand or brand == "No Brand":
        return brand
    # ตัดช่องว่าง
    brand = brand.strip()
    # แทนที่ช่องว่างภายในด้วย '' (ลบช่องว่างทั้งหมด)
    brand = re.sub(r'\s+', '', brand)
    # แปลงเป็น lowercase ทั้งหมด
    brand = brand.lower()
    # Optionally capitalize first letter ถ้าต้องการให้เป็นรูปแบบ Title? แต่ที่บอกว่าเจอตัวแรกเป็นพิมพ์ใหญ่ที่เหลือเล็ก แปลงเป็น lower แล้วอาจเก็บแบบ lower
    # หากต้องการให้ขึ้นต้นด้วยตัวพิมพ์ใหญ่: brand = brand.capitalize()
    return brand

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
    - ถ้าเจอชื่อย่อ ชื่อเล่น หรือชื่อไม่เป็นทางการ ให้ normalize เป็นชื่อแบรนด์ทางการเต็มๆ
    - ถ้าไม่แน่ใจว่าเป็นแบรนด์อะไร ให้ใช้ชื่อที่ปรากฏในข้อความตามจริง
    - ถ้ามี brand → ใส่ brand และ categoryจากรายการ แล้วให้ productType = ชื่อสินค้าหรือชนิดสินค้าที่ใกล้เคียงที่สุด
    - ถ้ามีสินค้าแต่ไม่มีbrandหรือไม่มีอะไรเลย → brand = "No Brand" category = "No Brand" แล้วให้ productType = ชื่อสินค้า/No Brand

    category ต้องเลือกเพียง 1 ประเภทจากรายการนี้เท่านั้น:
    - Fashion (Clothing, Vintage, Oversize, Streetwear, Watches, Jewelry)
    - Beauty & Personal Care (Skincare, Makeup, Perfume, Shampoo, Soap, Toothpaste)
    - Health & Wellness (Supplements, Vitamins, Fitness Equipment, Medicine)
    - Food & Beverage (Snacks, Coffee, Tea, Dried Food, Fresh Fruit, Clean Food)
    - Mom & Kids (Baby Products, Baby Toys, Maternity items)
    - IT & Gadgets (Phone Accessories, Bluetooth Headphones, Chargers, Smart Home)
    - Home & Living (Furniture, Minimalist Decor, Kitchenware, Air Fryer, Eco-friendly items)
    - Toys & Collectibles (Art Toy, Blind Box, Figures, Board Games)
    - Pet (Pet Food, Pet Toys, Pet Care)
    - Automotive (Car Accessories, Care products)
    - Lifestyle (DIY, Handmade, Travel, Vlog, Daily Life, Random stuff)
    - No Brand (ถ้าไม่มี brand)


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
                กฎ:
                - ถ้าเจอชื่อย่อ ชื่อเล่น หรือชื่อไม่เป็นทางการ ให้ normalize เป็นชื่อแบรนด์ทางการเต็มๆ
                - ถ้าไม่แน่ใจว่าเป็นแบรนด์อะไร ให้ใช้ชื่อที่ปรากฏในข้อความตามจริง
                - ถ้ามี brand → ใส่ brand และ categoryจากรายการ แล้วให้ productType = ชื่อสินค้าหรือชนิดสินค้าที่ใกล้เคียงที่สุด
                - ถ้ามีสินค้าแต่ไม่มีbrandหรือไม่มีอะไรเลย → brand = "No Brand" category = "No Brand" แล้วให้ productType = ชื่อสินค้า/No Brand

                category ต้องเลือกเพียง 1 ประเภทจากรายการนี้เท่านั้น:
                - Fashion (Clothing, Vintage, Oversize, Streetwear, Watches, Jewelry)
                - Beauty & Personal Care (Skincare, Makeup, Perfume, Shampoo, Soap, Toothpaste)
                - Health & Wellness (Supplements, Vitamins, Fitness Equipment, Medicine)
                - Food & Beverage (Snacks, Coffee, Tea, Dried Food, Fresh Fruit, Clean Food)
                - Mom & Kids (Baby Products, Baby Toys, Maternity items)
                - IT & Gadgets (Phone Accessories, Bluetooth Headphones, Chargers, Smart Home)
                - Home & Living (Furniture, Minimalist Decor, Kitchenware, Air Fryer, Eco-friendly items)
                - Toys & Collectibles (Art Toy, Blind Box, Figures, Board Games)
                - Pet (Pet Food, Pet Toys, Pet Care)
                - Automotive (Car Accessories, Care products)
                - Lifestyle (DIY, Handmade, Travel, Vlog, Daily Life, Random stuff)
                - No Brand (ถ้าไม่มี brand)

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
            "brand": normalize_brand(data.get("brand")) if data.get("brand") else "No Brand",
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
        "brand": normalize_brand(data.get("brand")) if data.get("brand") else "No Brand",
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