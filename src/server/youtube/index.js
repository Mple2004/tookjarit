const axios = require("axios");
require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const fetchChannelVideos = require("./chanel");
const analyzeVideo = require("./brand");
const cleanDocument = require("./cleanDoc");
const syncToNeo4j = require("./mongoToNeo4j");
const { fetchAndSaveTranscript } = require('./transcript');
const pLimit = require('p-limit');

const app = express();
app.use(express.json());
const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  collection: "youtuber",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function analyzeSingleText(text = "") {
  try {
    const response = await axios.post("http://127.0.0.1:8000/analyze", {
      text: text
    });
    return response.data;
  } catch (error) {
    console.error("❌ FastAPI Connection Error:", error.message);
    return { status: "error", sentiment: null, confidence: null };
  }
}

// ++++++++++++ [SECTION 1: DATA INGESTION] ++++++++++++++
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/youtube/search-channel", async (req, res) => {
  let { channelId, search, max = 5, minSubscribers = 1000 } = req.body;
  if (!channelId && !search)
    return res.status(400).json({ error: "channelId or search is required" });

  const client = new MongoClient(CONFIG.uri);
  //ค้นหาvdo
  try {
    if (!channelId && search) {
      const trimmed = search.trim();

      if (trimmed.startsWith('UC') && trimmed.length > 20) {
        channelId = trimmed;

      } else if (trimmed.startsWith('@')) {
        const query = trimmed.slice(1);
        const { google } = require('googleapis');
        const yt = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
        const searchRes = await yt.search.list({
          part: 'snippet', q: query, type: 'channel', maxResults: 1
        });
        channelId = searchRes.data.items?.[0]?.id?.channelId;
        if (!channelId) return res.status(404).json({ error: `ไม่พบช่อง: ${trimmed}` });
        console.log(`🔍 "${trimmed}" → channelId: ${channelId}`);

      } else {
        search = trimmed.replace(/^#/, '');
        channelId = null;
        console.log(`🔍 keyword mode: "${search}"`);
      }
    }

    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.collection);

    const videos = await fetchChannelVideos({
      channelId: channelId || null,
      search: !channelId ? search : null,
      max: parseInt(max)
    });

    console.log(`🚀 Found ${videos.length} videos`);
    if (videos.length === 0) {
      return res.json({ message: "No videos found", results: [] });
    }

    // ==================== PROCESS VIDEOS ====================
    const limit = pLimit(2);   // วิเคราะห์พร้อมกันสูงสุด 2 คลิป

    const results = await Promise.all(
      videos.map(v =>
        limit(async () => {
          try {
            // ─── ดึง + บันทึก Transcript ลง collection "transcripts" ───
            const transcript = await fetchAndSaveTranscript(v.videoId);
            
            // Analyze brand
            const existingData = await col.findOne({ videoId: v.videoId });
            const shouldAnalyze = !existingData ||
              ["No Brand", "None", "Error", ""].includes(existingData.brand || "");

            let finalAnalysis;

            if (shouldAnalyze) {
              console.log(`🔍 Analyzing: ${v.title}`);
              const analysis = await analyzeVideo(v.url, v.title, v.caption);

              const isNoBrand = analysis?.status === "no_brand" || !analysis?.brand;

              if (isNoBrand) {
                console.log(`⏭️ No brand found: ${v.title}`);

                // ยังคง sync comments แม้ไม่มี brand
                const commentCol = client.db(CONFIG.db).collection("comments");
                const commentsToInsert = (v.comments || [])
                    .filter(c => c.text && c.text.trim() !== "")
                    .map(c => ({
                        videoId: v.videoId,
                        influencerName: v.authorName,
                        channelId: v.channelId,
                        platform: "youtube",
                        text: c.text,
                        likeCount: c.likeCount || null,
                        sentiment: null,
                        confidence: null,
                    }));

                if (commentsToInsert.length > 0) {
                    const bulkOps = commentsToInsert.map(c => ({
                        updateOne: {
                            filter: { videoId: c.videoId, text: c.text, platform: "youtube" },
                            update: { $setOnInsert: c },
                            upsert: true,
                        },
                    }));
                    await commentCol.bulkWrite(bulkOps, { ordered: false });

                    await Promise.all(
                        commentsToInsert.map(async (c) => {
                            try {
                                const result = await analyzeSingleText(c.text);
                                if (result.status === "success") {
                                    await commentCol.updateOne(
                                        { videoId: c.videoId, text: c.text, platform: "youtube" },
                                        { $set: { sentiment: result.sentiment, confidence: result.confidence } }
                                    );
                                }
                            } catch (err) {
                                console.error(`❌ sentiment error: ${err.message}`);
                            }
                        })
                    );
                    console.log(`✅ Synced + Sentiment done (No Brand) for ${v.videoId}`);
                }

                return { videoId: v.videoId, title: v.title, brand: "No Brand", skipped: true };
              }

                finalAnalysis = {
                  brand: analysis.brand || "No Brand",
                  productType: analysis.productType || "None",
                  category: analysis.category || "No Brand",
                };
              } else {
                finalAnalysis = {
                  brand: existingData.brand,
                  productType: existingData.productType,
                  category: existingData.category,
                };
              }

            // Update to MongoDB
            await col.updateOne(
              { videoId: v.videoId },
              {
                $set: {
                  channelId: v.channelId ?? "None",
                  authorName: v.authorName ?? "None",
                  authorAvatar: v.authorAvatar || "",
                  subscribers: v.subscribers || 0,        // ← บันทึกจำนวน subscriber
                  channelViews: v.channelViews || 0,
                  platform: "youtube",
                  videoId: v.videoId,
                  title: v.title,
                  caption: v.caption ?? "None",
                  url: v.url,
                  totalViews: parseInt(v.totalViews) || 0,
                  totalLikes: parseInt(v.totalLikes) || 0,
                  totalComments: parseInt(v.totalComments) || 0,
                  brand: finalAnalysis.brand,
                  productType: finalAnalysis.productType,
                  category: finalAnalysis.category,
                  hasTranscript: !!transcript,
                  lastUpdate: new Date(),
                },
                $addToSet: { comments: { $each: v.comments || [] } },
              },
              { upsert: true }
            );

            await cleanDocument(col, v.videoId);

            // ─── Auto sync + Auto sentiment ───
            const commentCol = client.db(CONFIG.db).collection("comments");

            const commentsToInsert = (v.comments || [])
              .filter(c => c.text && c.text.trim() !== "")
              .map(c => ({
                videoId: v.videoId,
                influencerName: v.authorName,
                channelId: v.channelId,
                platform: "youtube",
                text: c.text,
                likeCount: c.likeCount || null,
                sentiment: null,
                confidence: null,
              }));

            if (commentsToInsert.length > 0) {
              // 1. Insert comments ที่ยังไม่มีก่อน
              const bulkOps = commentsToInsert.map(c => ({
                updateOne: {
                  filter: { videoId: c.videoId, text: c.text, platform: "youtube" },
                  update: { $setOnInsert: c },
                  upsert: true,
                },
              }));
              await commentCol.bulkWrite(bulkOps, { ordered: false });
              console.log(`💬 Synced ${commentsToInsert.length} comments → ${v.videoId}`);

              // 2. วิเคราะห์ sentiment ทันทีเลย (แค่ 3 comments เบามาก)
              await Promise.all(
                commentsToInsert.map(async (c) => {
                  try {
                    const result = await analyzeSingleText(c.text);
                    if (result.status === "success") {
                      await commentCol.updateOne(
                        { videoId: c.videoId, text: c.text, platform: "youtube" },
                        { $set: { sentiment: result.sentiment, confidence: result.confidence } }
                      );
                    }
                  } catch (err) {
                    console.error(`❌ sentiment error: ${err.message}`);
                  }
                })
              );
              console.log(`✅ Sentiment done for ${v.videoId}`);
            }

            return {
              videoId: v.videoId,
              title: v.title,
              subscribers: v.subscribers || 0,
              ...finalAnalysis
            };

          } catch (err) {
            console.error(`❌ Failed ${v.videoId}:`, err.message);
            return { videoId: v.videoId, error: err.message };
          }
        })
      )
    );

    // Sync Neo4j แบบไม่บล็อก
    await syncToNeo4j().catch(e => console.error('❌ Neo4j sync error:', e.message));
    res.json({
      message: `✅ Processed ${results.length} videos`,
      totalFound: videos.length,
      results,
    });

  } catch (err) {
    console.error("search-channel error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ดึงcommentsจาก youtuber collection มาใส่ใน comments collection (ใช้ในกรณีที่เพิ่งเพิ่มฟีเจอร์ comment sentiment แล้วอยากวิเคราะห์คอมเมนต์เก่าๆที่มีอยู่แล้ว)
app.post("/api/youtube/migrate-comments", async (req, res) => {
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const db = client.db(CONFIG.db);
    const youtuberCol = db.collection("youtuber");
    const commentCol = db.collection("comments");

    //หา videos ที่มี comment จาก youtuber collection
    const videos = await youtuberCol.find({
      platform: "youtube",
      comments: { $exists: true, $ne: [] }
    }).toArray();
    console.log(`📦 Found ${videos.length} videos to migrate`);


    let total = 0;
    for (const v of videos) {
      //ปรับข้อมูลให้เป็นรูปแบบเดียวกับ comment collection
      const commentsToInsert = (v.comments || [])
        .filter(c => c.text && c.text.trim() !== "")
        .map(c => ({
          videoId: v.videoId,
          influencerName: v.authorName,
          channelId: v.channelId,
          platform: "youtube",
          text: c.text,
          likeCount: c.likeCount || null,
          sentiment: null,
          confidence: null,
        }));

      //บันทึกลง collection จริง (upsert แบบไม่ซ้ำ)
      if (commentsToInsert.length > 0) {
        const bulkOps = commentsToInsert.map(c => ({
          updateOne: {
            filter: { videoId: c.videoId, text: c.text, platform: "youtube" },
            update: { $setOnInsert: c },
            upsert: true,
          },
        }));
        await commentCol.bulkWrite(bulkOps, { ordered: false });
        total += commentsToInsert.length;
        console.log(`✅ ${v.authorName} - ${v.videoId}: ${commentsToInsert.length} comments`);
      }
    }

    res.json({ message: `✅ Migrated ${total} comments`, total });
  } catch (err) {
    console.error("migrate-comments error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ++++++++++++ [SECTION 2: DATA PROCESSING] ++++++++++++++
// ─────────────────────────────────────────────────────────────────────────────
//วิเคราะห์คอมเม้นต์
app.post("/api/youtube/analyze-sentiment", async (req, res) => {
  const { videoId, influencerName } = req.body;
  if (!videoId && !influencerName)
    return res.status(400).json({ error: "videoId or influencerName is required" });

  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const commentCol = client.db(CONFIG.db).collection("comments");
 
    const filter = {
      platform: "youtube",
      sentiment: null,             // เฉพาะที่ยังไม่มีผล
      text: { $exists: true, $ne: "" },
    };
    if (videoId)        filter.videoId        = videoId;
    if (influencerName) filter.influencerName  = new RegExp(influencerName, "i");
 
    const docs = await commentCol.find(filter).toArray();
    if (docs.length === 0)
      return res.json({ message: "No pending comments found", processed: 0 });
    console.log(`💬 Analyzing ${docs.length} comments...`);
 
    let success = 0, failed = 0;
    const limit = pLimit(10);
    await Promise.all(
      docs.map(doc =>
        limit(async () => {
          try {
            // เรียกใช้ฟังก์ชันใหม่ที่ยิง API ไปหา Python
            const result = await analyzeSingleText(doc.text || "");

            if (result.status === "success") {
              await commentCol.updateOne(
                { _id: doc._id },
                {
                  $set: {
                    sentiment: result.sentiment,
                    confidence: result.confidence,
                  },
                }
              );
              success++;
            } else {
              failed++;
            }
          } catch (err) {
            failed++;
          }
        })
      )
    );
 
    console.log(`✅ Done: ${success} success, ${failed} failed`);
    res.json({
      message: `✅ Analyzed ${success} comments (${failed} failed)`,
      total: docs.length,
      success,
      failed,
    });
 
  } catch (err) {
    console.error("analyze-sentiment error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//เชื่อมต่อกับ Neo4j เพื่ออัพเดตข้อมูลแบบ real-time หลังจากที่มีการเพิ่ม/อัพเดตวิดีโอใน MongoDB (ใช้ในกรณีที่เพิ่งเพิ่มฟีเจอร์ Neo4j แล้วอยากซิงค์ข้อมูลเก่าๆที่มีอยู่แล้ว)
app.post("/api/youtube/sync-neo4j", async (req, res) => {
  try {
    await syncToNeo4j();
    res.json({ message: "✅ Neo4j sync complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ++++++++++++ [SECTION 3: DATA RETRIEVAL] ++++++++++++++
// ─────────────────────────────────────────────────────────────────────────────
//ดึงรายการวิดีโอโดยกรองได้ด้วย authorName, brand, category และจำกัดจำนวนผลลัพธ์ด้วย limit
app.get("/api/youtube/data", async (req, res) => {
  const { authorName, brand, category, limit = 50 } = req.query;
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.collection);

    const filter = { platform: "youtube" };
    if (authorName) filter.authorName = new RegExp(authorName, "i");
    if (brand) filter.brand = new RegExp(brand, "i");
    if (category) filter.category = category;

    const data = await col
      .find(filter)
      .limit(parseInt(limit))
      .toArray();

    res.json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ดึงวิดีโอที่มี totalViews สูงสุด 3 อันดับแรกของแต่ละแบรนด์สำหรับ authorName ที่ระบุ
app.get('/api/youtube/top-videos-by-brand', async (req, res) => {
    const { authorName } = req.query;
    if (!authorName) return res.status(400).json({ error: 'authorName is required' });
    const client = new MongoClient(CONFIG.uri);

    try {
        await client.connect();
        const col = client.db(CONFIG.db).collection(CONFIG.collection);

        const results = await col.aggregate([
            {
                $match: {
                    authorName,
                    platform: 'youtube',
                    url: { $exists: true, $ne: '' },
                }
            },
            { $sort: { totalViews: -1 } },
            {
                $group: {
                    _id: '$brand',
                    brand:      { $first: '$brand' },
                    videoId:    { $first: '$videoId' },
                    videoUrl:   { $first: '$url' }, // ✅ map url → videoUrl
                    channelId:  { $first: '$channelId' },
                    totalLikes: { $first: '$totalLikes' },
                    totalViews: { $first: '$totalViews' },
                    caption:    { $first: '$caption' },
                    category:   { $first: '$category' },
                    title:      { $first: '$title' },
                }
            },
            { $sort: { totalViews: -1 } },
            { $limit: 3 },
        ]).toArray();

        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await client.close();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//การคำนวณผลการวิเคราะห์คอมเมนต์จากหลายๆคลิปพร้อมกัน (ใช้ในหน้า influencer profile)
app.get("/api/youtube/sentiment-summary", async (req, res) => {
  const { influencerName, videoId, videoIds } = req.query;
 
  if (!influencerName && !videoId && !videoIds)
    return res.status(400).json({ error: "influencerName or videoId is required" });
 
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const commentCol = client.db(CONFIG.db).collection("comments");
    const match = { platform: "youtube", sentiment: { $ne: null } };
    
    // if (videoIds  && videoIds.trim() !== "") {
    //     // กรณีระบุหลายวิดีโอ (ตามแบรนด์)
    //     const ids = videoIds.split(',').filter(id => id.trim() !== "");
    //     match.videoId = { $in: ids };
    // } else if (videoId) {
    //     // กรณีระบุวิดีโอเดียว
    //     match.videoId = videoId;
    // } else if (influencerName) {
    //     // กรณีดูภาพรวมทั้งอินฟลู (ไม่มีการกรองวิดีโอ)
    //     match.influencerName = new RegExp(influencerName, "i");
    // }

    if (videoIds && videoIds.trim() !== "") {  // ← แก้ videoId → videoIds
        const ids = videoIds.split(',').filter(id => id.trim() !== "");
        match.videoId = { $in: ids };
    } else if (videoId) {
        match.videoId = videoId;
    } else if (influencerName) {
        match.influencerName = new RegExp(influencerName, "i");
    }
 
    // aggregate: group by sentiment,นับจำนวนคอมเมนต์ในแต่ละกลุ่ม และคำนวณค่าเฉลี่ย confidence
    const agg = await commentCol.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$sentiment",
          count:         { $sum: 1 },
          avgConfidence: { $avg: "$confidence" },
        },
      },
    ]).toArray();
 
    if (agg.length === 0)
      return res.json({
        message: "No analyzed comments found. Run POST /analyze-sentiment first.",
        data: null,
      });
 
    const total = agg.reduce((s, g) => s + g.count, 0);
    const byLabel = {};
    for (const g of agg) {
      byLabel[g._id] = {
        count:         g.count,
        percent:       +((g.count / total) * 100).toFixed(1),
        avgConfidence: +g.avgConfidence.toFixed(4),
      };
    }
 
    const dominant = agg.sort((a, b) => b.count - a.count)[0]._id;
 
    res.json({
      ...(influencerName ? { influencerName } : {}),
      ...(videoId        ? { videoId }        : {}),
      totalComments: total,
      dominantSentiment: dominant, //Sort เพื่อหาว่าอารมณ์ไหน "มาแรงที่สุด"
      positive: byLabel["POSITIVE"] || { count: 0, percent: 0, avgConfidence: 0 },
      neutral:  byLabel["NEUTRAL"]  || { count: 0, percent: 0, avgConfidence: 0 },
      negative: byLabel["NEGATIVE"] || { count: 0, percent: 0, avgConfidence: 0 },
    });
 
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ดึงตัวอย่างคอมเมนต์โดยแบ่งกลุ่มตามSentiment ใช้ในหน้า influencer profile
app.get("/api/youtube/comment-samples", async (req, res) => {
  const { influencerName, brand, limit = 3 } = req.query;

  if (!influencerName || !brand)
    return res.status(400).json({ error:"ไม่พบ influencerName หรือ brand" });

  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const db         = client.db(CONFIG.db);
    const youtuberCol = db.collection("youtuber");
    const commentCol  = db.collection("comments");

    //หา videoId ที่ตรงกับ influencer + brand
    const matchingVideos = await youtuberCol.find(
      {
        authorName: new RegExp(`^${influencerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        brand:      new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        platform:   "youtube",
      },
      { projection: { videoId: 1, _id: 0 } }
    ).toArray();

    const videoIds = matchingVideos.map(v => v.videoId).filter(Boolean);
    if (videoIds.length === 0) {
      return res.json({ positive: [], neutral: [], negative: [], videoIds: [] });
    }

    //ดึงตัวอย่าง comment แยกตาม sentiment
    const sampleLimit = parseInt(limit);
    const [positive, neutral, negative] = await Promise.all([
      commentCol.find(
        { videoId: { $in: videoIds }, sentiment: "POSITIVE", platform: "youtube" },
        { projection: { text: 1, confidence: 1, videoId: 1, _id: 0 } }
      ).limit(sampleLimit).toArray(),

      commentCol.find(
        { videoId: { $in: videoIds }, sentiment: "NEUTRAL", platform: "youtube" },
        { projection: { text: 1, confidence: 1, videoId: 1, _id: 0 } }
      ).limit(sampleLimit).toArray(),

      commentCol.find(
        { videoId: { $in: videoIds }, sentiment: "NEGATIVE", platform: "youtube" },
        { projection: { text: 1, confidence: 1, videoId: 1, _id: 0 } }
      ).limit(sampleLimit).toArray(),
    ]);

    res.json({ positive, neutral, negative, videoIds });

  } catch (err) {
    console.error("comment-samples error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// +++++++++ [SECTION 4: SYSTEM & MONITORING] ++++++++++++
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/youtube/health", (req, res) => {
  res.json({ status: "ok", service: "youtube-backend", port: PORT });
});

// ─────────────────────────────────────────────────────────────────────────────
//ดึงการค้นหาล่าสุดจาก lastUpdate field ของ document ล่าสุดใน youtuber collection
app.get('/api/last-updated', async (req, res) => {
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.collection);
    const latest = await col
      .find({ platform: 'youtube', lastUpdate: { $exists: true } })
      .sort({ lastUpdate: -1 })
      .limit(1)
      .toArray();
    res.json({ lastUpdated: latest[0]?.lastUpdate || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ดึงจาก lastUpdate เหมือนกัน (YouTube ไม่มี lastSynced แยก)
app.get('/api/last-refreshed', async (req, res) => {
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const col = client.db(CONFIG.db).collection(CONFIG.collection);
    const latest = await col
      .find({ platform: 'youtube', lastUpdate: { $exists: true } })
      .sort({ lastUpdate: -1 })
      .limit(1)
      .toArray();
    res.json({ lastRefreshed: latest[0]?.lastUpdate || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

const PORT = process.env.YOUTUBE_PORT || 5001;
app.listen(PORT, () =>
  console.log(`🎬 YouTube backend running on port ${PORT}`)
);