require("dotenv").config();
const { MongoClient } = require("mongodb");
const analyzeSingleText = require("./sentiment"); // ไฟล์นี้ต้องใช้ axios ยิงไปที่พอร์ต 8000 แล้ว
const pLimit = require("p-limit");

const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  collection: "comments",
};

async function runNow() {
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const commentCol = client.db(CONFIG.db).collection(CONFIG.collection);

    // 1. ดึงคอมเมนต์ทั้งหมดที่ยังไม่ได้วิเคราะห์
    console.log("🔍 กำลังดึงข้อมูลจาก MongoDB...");
    const docs = await commentCol.find({ sentiment: null }).toArray();

    if (docs.length === 0) {
      return console.log("✅ ไม่มีคอมเมนต์ค้างวิเคราะห์ในฐานข้อมูล");
    }

    console.log(`🚀 เริ่มวิเคราะห์ทั้งหมด ${docs.length} รายการ (Fast Mode)...`);
    
    // 2. ตั้งค่า Concurrency (รันพร้อมกันกี่รายการ)
    // เนื่องจากตอนนี้ Python Server โหลดโมเดลรอไว้แล้ว สามารถเพิ่มเป็น 5-10 ได้เลยครับ
    const limit = pLimit(10); 
    let successCount = 0;

    // 3. เริ่มประมวลผล
    const tasks = docs.map((doc) =>
      limit(async () => {
        try {
          // เรียกฟังก์ชันที่ยิง HTTP Request ไปหา FastAPI
          const result = await analyzeSingleText(doc.text || "");
          
          if (result && result.status === "success") {
            await commentCol.updateOne(
              { _id: doc._id },
              { 
                $set: { 
                  sentiment: result.sentiment, // POSITIVE / NEUTRAL / NEGATIVE
                  confidence: result.confidence 
                } 
              }
            );
            successCount++;
            
            // แสดง Log ทุกๆ 10 รายการเพื่อติดตามความคืบหน้า
            if (successCount % 10 === 0 || successCount === docs.length) {
              console.log(`⏳ วิเคราะห์เสร็จแล้ว ${successCount}/${docs.length} รายการ...`);
            }
          }
        } catch (err) {
          console.error(`❌ ผิดพลาดที่ _id ${doc._id}:`, err.message);
        }
      })
    );

    await Promise.all(tasks);
    console.log(`\n🏁 เสร็จสิ้น! วิเคราะห์สำเร็จทั้งสิ้น ${successCount} รายการ`);

  } catch (err) {
    console.error("🚨 เกิดข้อผิดพลาดร้ายแรง:", err);
  } finally {
    await client.close();
  }
}

runNow();