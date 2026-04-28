const { execFile } = require("child_process");
const path = require("path");
require("dotenv").config();
const { MongoClient } = require("mongodb");
 
const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  transcriptsCol: "transcripts",
};

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

  return new Promise((resolve, reject) => {
    execFile(
      "python", // หรือ "python3" ตามเครื่องที่ใช้
      [scriptPath, videoId],
      options,
      (error, stdout, stderr) => {
        if (error) {
          console.error("❌ Execution Error:", stderr);
          return reject(error);
        }

        try {
          // คลีน stdout เพื่อดึงเฉพาะส่วนที่เป็น JSON
          const output = stdout.toString("utf8").trim();
          const match = output.match(/\{[\s\S]*\}/);
          
          if (!match) throw new Error("ไม่พบรูปแบบ JSON ในผลลัพธ์ของ Python");

          const data = JSON.parse(match[0]);

          if (data.status === "error") {
            return reject(new Error(data.message));
          }

          resolve(data.transcript);
        } catch (parseError) {
          console.error("❌ Raw Output จาก Python:", stdout);
          reject(new Error("การแปลงข้อมูล JSON ผิดพลาด"));
        }
      }
    );
  });
}

async function fetchAndSaveTranscript(videoId) {
  const transcript = await fetchTranscript(videoId);
 
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.transcriptsCol);
 
    await col.updateOne(
      { videoId },
      {
        $set: {
          videoId,
          transcript: transcript || null,
          hasTranscript: !!transcript,
          lastUpdate: new Date(),
        },
      },
      { upsert: true }
    );
 
    if (transcript) {
      console.log(`💾 Transcript saved [${videoId}] (${transcript.length} chars)`);
    } else {
      console.log(`⚠️ No transcript [${videoId}]`);
    }
  } catch (err) {
    console.error(`❌ Transcript DB error [${videoId}]: ${err.message}`);
  } finally {
    await client.close();
  }
 
  return transcript;
}
 
module.exports = { fetchTranscript, fetchAndSaveTranscript };