require("dotenv").config();
const { MongoClient } = require("mongodb");

const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  collection: "youtuber",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// รับ YouTubeTranscript เข้ามาเป็น Argument เพื่อไม่ต้อง import ซ้ำ
async function fetchTranscript(ytTool, videoId) {
  try {
    // ดึงภาษาไทย (รวม Auto-gen)
    const transcriptConfig = await ytTool.fetchTranscript(videoId, { lang: 'th' });

    if (transcriptConfig && transcriptConfig.length > 0) {
      const text = transcriptConfig
        .map((t) => t.text.trim())
        .filter(Boolean)
        .join(" ");
      return { transcript: text, lang: 'th-auto' };
    }
  } catch (err) {
    try {
      // Backup เป็นภาษาอะไรก็ได้ที่วิดีโอนั้นมี
      const backupTranscript = await ytTool.fetchTranscript(videoId);
      if (backupTranscript && backupTranscript.length > 0) {
        return { 
          transcript: backupTranscript.map(t => t.text).join(" "), 
          lang: 'auto-other' 
        };
      }
    } catch (innerErr) { }
  }
  return { transcript: null, lang: null };
}

async function backfillTranscripts() {
  // 1. โหลด Module แค่ครั้งเดียวที่นี่
  const { YouTubeTranscript } = await import('youtube-transcript');
  
  const client = new MongoClient(CONFIG.uri);

  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.collection);

    const docs = await col
      .find({
        platform: "youtube",
        videoId: { $exists: true, $ne: "null", $ne: null },
        $or: [
          { transcript: { $exists: false } },
          { transcript: null },
          { transcript: "" }
        ]
      })
      .project({ _id: 1, videoId: 1, title: 1 })
      .toArray();

    console.log(`📋 Found ${docs.length} videos without transcript`);

    let success = 0;
    let nullCount = 0;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      console.log(`[${i + 1}/${docs.length}] 🔍 ${doc.videoId} — ${doc.title?.slice(0, 50)}`);

      // 2. ส่ง YouTubeTranscript (ytTool) เข้าไปในฟังก์ชัน
      const { transcript, lang } = await fetchTranscript(YouTubeTranscript, doc.videoId);

      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            transcript: transcript ?? null,
            transcriptLang: lang ?? null,
            lastUpdate: new Date(),
          },
        }
      );

      if (transcript) {
        console.log(`   ✅ [${lang}] ${transcript.slice(0, 60)}...`);
        success++;
      } else {
        console.log(`   ⚠️  No subtitle found`);
        nullCount++;
      }

      // หน่วงเวลา 1 วินาที เพื่อความปลอดภัยต่อ IP ของคุณ
      await sleep(1000); 
    }

    console.log("\n─────────────────────────────────");
    console.log(`✅ Success    : ${success}`);
    console.log(`⚠️  No subtitle: ${nullCount}`);
    console.log(`📦 Total      : ${docs.length}`);

  } catch (err) {
    console.error("🚨 Critical Error:", err.message);
  } finally {
    await client.close();
    console.log("🔌 MongoDB disconnected");
  }
}

backfillTranscripts();