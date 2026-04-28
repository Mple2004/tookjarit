from youtube_transcript_api import YouTubeTranscriptApi
import sys,re,io,json,os,requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def cleanText(text):
    # 1. ลบข้อความในวงเล็บเหลี่ยมออก เช่น [ดนตรี], [Laughter]
    text = re.sub(r'\[.*?\]', '', text)
    
    # 2. ลบขึ้นบรรทัดใหม่ และแทนที่ด้วยช่องว่าง
    text = text.replace('\n', ' ')
    
    # 3. ลบช่องว่างที่ซ้ำกันเกิน 1 ช่องให้เหลือช่องเดียว
    text = re.sub(r'\s+', ' ', text)
    
    # 4. ตัดช่องว่างหน้าและหลังสุดออก
    return text.strip()
def make_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    cookies_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")
    if os.path.exists(cookies_path):
        try:
            with open(cookies_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("\t")
                    if len(parts) >= 7:
                        domain, _, path, secure, expires, name, value = parts[:7]
                        session.cookies.set(name, value, domain=domain)
            print("[cookies] loaded", file=sys.stderr)
        except Exception as e:
            print(f"[cookies] error: {e}", file=sys.stderr)
    else:
        print("[cookies] cookies.txt not found", file=sys.stderr)
    return session

def get_youtube_transcript(id):
    try:
        session = make_session()
        ytt_api = YouTubeTranscriptApi(http_client=session)
        transcript = ytt_api.fetch(id,languages=['th', 'en'])
        full_text = " ".join([entry.text for entry in transcript])
        full_text = cleanText(full_text)
        return {
            "status": "success",
            "transcript": full_text
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error: {str(e)}"
        }

if __name__ == "__main__":
    video_id = sys.argv[1] if len(sys.argv) > 1 else ""
    if video_id:
        result = get_youtube_transcript(video_id)
    else:
        result = {"status": "error", "message": "No Video ID provided"}

    print(json.dumps(result, ensure_ascii=False))