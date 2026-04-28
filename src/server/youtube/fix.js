require("dotenv").config();
const { MongoClient } = require("mongodb");
const { execFile } = require("child_process");
const path = require("path");
const pLimit = require('p-limit');
const fetchTranscript = require('../youtube/transcript.js');

const CONFIG = {
    uri: process.env.Test_MONGODB,
    db: "InfluencerProject",
    videosCol: "youtuber",
    transcriptsCol: "transcripts",
};

const LIMIT = 2; // ประมวลผลพร้อมกันสูงสุด 2 วิดีโอ
const WAIT_TIME = 8000; // พัก 2 วินาทีระหว่างตัว

async function startBatchProcess() {
    const client = new MongoClient(CONFIG.uri);

    try {
        console.log(`🔌 Connecting to MongoDB: ${CONFIG.db}...`);
        await client.connect();
        
        const db = client.db(CONFIG.db);
        const sourceCol = db.collection(CONFIG.videosCol);
        const targetCol = db.collection(CONFIG.transcriptsCol);

        // 1. ดึงรายการวิดีโอทั้งหมดจากต้นทาง (ดึงมาเฉพาะ videoId)
        const allVideos = await sourceCol.find(
            { videoId: { $exists: true } }, 
            { projection: { videoId: 1 } }
        ).toArray();
        
        // 2. ตรวจสอบว่าตัวไหนทำเสร็จไปแล้วบ้าง
        const completedDocs = await targetCol.find(
            {}, 
            { projection: { videoId: 1 } }
        ).toArray();
        const completedIds = new Set(completedDocs.map(d => d.videoId));

        // 3. กรองรายการที่ยังไม่ได้ประมวลผล
        const pendingVideos = allVideos.filter(v => v.videoId && !completedIds.has(v.videoId));

        console.log(`-------------------------------------------`);
        console.log(`📊 Total in Source: ${allVideos.length}`);
        console.log(`✅ Already Done   : ${completedIds.size}`);
        console.log(`⏳ Remaining      : ${pendingVideos.length}`);
        console.log(`-------------------------------------------`);

        if (pendingVideos.length === 0) {
            console.log("🙌 No pending videos to process.");
            return;
        }

        const limit = pLimit(LIMIT);
        let currentIdx = 0;

        const tasks = pendingVideos.map((video) => {
            return limit(async () => {
                const vid = video.videoId;
                currentIdx++;
                
                console.log(`🚀 [${currentIdx}/${pendingVideos.length}] Processing: ${vid}`);

                try {
                    // เรียกใช้ฟังก์ชันดึง Transcript
                    const transcriptContent = await fetchTranscript(vid);

                    // อัปเดตข้อมูลลง MongoDB (Native Driver Style)
                    await targetCol.updateOne(
                        { videoId: vid },
                        { 
                            $set: { 
                                content: transcriptContent, 
                                status: 'success', 
                                updatedAt: new Date() 
                            } 
                        },
                        { upsert: true }
                    );
                    console.log(`✔️  Saved: ${vid}`);

                } catch (err) {
                    console.error(`❌ Error: ${vid} -> ${err.message}`);
                    // ถ้าโดนแบน IP ให้หยุดสคริปต์ทันที
                    if (err.message.includes("IP is blocked") || err.message.includes("Too Many Requests")) {
                        console.error("🚨 EMERGENCY STOP: YouTube blocked our IP. Please wait a few hours.");
                        process.exit(1); 
                    }
                    
                    // บันทึกสถานะ error
                    await targetCol.updateOne(
                        { videoId: vid },
                        { 
                            $set: { 
                                status: 'error', 
                                lastError: err.message, 
                                updatedAt: new Date() 
                            } 
                        },
                        { upsert: true }
                    );
                }

                // ป้องกัน Rate Limit จาก YouTube
                await new Promise(r => setTimeout(r, WAIT_TIME));
            });
        });

        await Promise.all(tasks);
        console.log(`🏁 All ${pendingVideos.length} videos have been processed.`);

    } catch (error) {
        console.error("💥 Batch Process Failed:", error);
    } finally {
        await client.close();
        console.log("👋 Closed MongoDB connection.");
        process.exit(0);
    }
}

startBatchProcess();