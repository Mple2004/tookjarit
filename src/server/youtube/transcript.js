const { execFile } = require("child_process");
const path = require("path");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");
 
const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  transcriptsCol: "transcripts",
};
const genAI = new GoogleGenerativeAI(process.env.TS_GEMINI_API_KEY);

/**
 * ฟังก์ชันเรียกใช้ Python เพื่อดึง Transcript
 * @param {string} videoId - ไอดีของวิดีโอ YouTube (เช่น qp72ucQ0joc)
 */
function fetchTranscript(videoId) {
  const scriptPath = path.join(__dirname, "transcript.py");

  const options = {
    maxBuffer: 10 * 1024 * 1024, // จอง Buffer 10MB กัน Transcript ยาวเกินไป
    cwd: __dirname,
  };

  return new Promise((resolve) => {            // ← resolve เท่านั้น ไม่มี reject
    execFile(PYTHON, [scriptPath, videoId], options, (error, stdout, stderr) => {
      try {
        const output = stdout?.toString("utf8").trim() || "";
        const match = output.match(/\{[\s\S]*\}/);
        if (!match) return resolve(null);
 
        const data = JSON.parse(match[0]);
        if (data.status === "error") {
          console.warn(`⚠️ Transcript unavailable [${videoId}]: ${data.message?.slice(0, 80)}`);
          return resolve(null);
        }
        resolve(data.transcript || null);
      } catch (e) {
        console.warn(`⚠️ Transcript parse error [${videoId}]: ${e.message}`);
        resolve(null);
      }
    });
  });
}

async function analyzeHashtags(transcript, caption, title) {
  try {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" } 
    });
    
 
    const prompt = `
    วิเคราะห์เนื้อหาของวิดีโอ YouTube นี้แล้วสรุปออกมาเป็น hashtag ที่เหมาะสม 3 อัน
    
    ชื่อวิดีโอ: ${title || "Untitled"}
    Caption: ${caption?.slice(0, 500) || ""}
    Transcript: ${transcript?.slice(0, 2000) || ""}
    
    ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
    {
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
    "summary": "สรุปเนื้อหาสั้นๆ ภาษาไทย 1 ประโยค"
    }`;
 
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error(`❌ Gemini error: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ดึง transcript + บันทึกลง MongoDB (รวม hashtags ถ้า analyzeNow = true)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAndSaveTranscript(videoId, { caption, title, analyzeNow = false } = {}) {
  const transcript = await fetchTranscript(videoId);
 
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.transcriptsCol);
 
    // ─── วิเคราะห์ hashtag ถ้าขอ และมี transcript หรือ caption/title ───
    let analysisResult = null;
    if (analyzeNow) {
      // ตรวจว่ามี hashtag ใน DB แล้วหรือยัง (ไม่วิเคราะห์ซ้ำ)
      const existing = await col.findOne({ videoId }, { projection: { hashtags: 1 } });
      if (existing?.hashtags?.length) {
        console.log(`♻️  Hashtags already exist [${videoId}] — skip Gemini`);
        analysisResult = { hashtags: existing.hashtags, summary: existing.summary };
      } else if (transcript || caption || title) {
        console.log(`🤖 Analyzing hashtags [${videoId}]...`);
        analysisResult = await analyzeHashtags(transcript, caption, title);
      }
    }
 
    // ─── upsert ลง transcripts collection ───
    const setFields = {
      videoId,
      transcript: transcript || null,
      hasTranscript: !!transcript,
      lastUpdate: new Date(),
    };
 
    if (analysisResult) {
      setFields.hashtags = analysisResult.hashtags || [];
      setFields.summary  = analysisResult.summary  || "";
      setFields.analysisUpdatedAt = new Date();
    }
 
    await col.updateOne({ videoId }, { $set: setFields }, { upsert: true });
 
    if (transcript) {
      console.log(`💾 Transcript saved [${videoId}] (${transcript.length} chars)`);
    } else {
      console.log(`⚠️ No transcript [${videoId}]`);
    }
    if (analysisResult) {
      console.log(`🏷️  Hashtags saved [${videoId}]: ${analysisResult.hashtags?.join(", ")}`);
    }
  } catch (err) {
    console.error(`❌ Transcript DB error [${videoId}]: ${err.message}`);
  } finally {
    await client.close();
  }
 
  return transcript;
}
 
module.exports = { fetchTranscript, fetchAndSaveTranscript, analyzeHashtags };