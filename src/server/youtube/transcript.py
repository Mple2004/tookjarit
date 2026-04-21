from youtube_transcript_api import YouTubeTranscriptApi
import sys
import json

def get_youtube_transcript(video_id):
    try:
        # ดึงซับภาษาไทย ถ้าไม่มีให้ลองดึงภาษาอังกฤษ
        #transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['th', 'en'])
        ytt_api = YouTubeTranscriptApi()
        id = 'U_5oIm_q07w'
        transcript = ytt_api.fetch(id,languages=['th'])
        # for entry in transcript:
        #     print(f"{entry.text}")
        full_text = " ".join([entry.text for entry in transcript])
        return full_text
        
        # รวมข้อความทั้งหมดเป็น String เดียว
        #full_text = " ".join([entry['text'] for entry in transcript])
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    # รับ video_id จากการเรียกผ่าน Command Line (ถ้าจะเชื่อมกับ Node.js)
    if len(sys.argv) > 1:
        v_id = sys.argv[1]
        print(get_youtube_transcript(v_id))
    test_id = 'U_5oIm_q07w' 
    print(get_youtube_transcript(test_id))