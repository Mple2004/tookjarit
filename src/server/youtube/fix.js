/**
 * remove-comments-field.js — One-time migration script
 * วางไฟล์นี้ใน /server/youtube/ แล้วรัน: node remove-comments-field.js
 * ลบ field "comments" ออกจาก youtuber collection ทั้งหมด
 */

require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.Test_MONGODB;
const DB_NAME   = "InfluencerProject";

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    const col = client.db(DB_NAME).collection("youtuber");

    const result = await col.updateMany(
      { comments: { $exists: true } },
      { $unset: { comments: "" } }
    );

    console.log(`✅ ลบ comments field ออกจาก ${result.modifiedCount} documents เรียบร้อย`);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
    console.log("🔌 MongoDB disconnected");
  }
}

main();