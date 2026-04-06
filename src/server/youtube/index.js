const axios = require("axios");
require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const fetchChannelVideos = require("./chanel");
const analyzeVideo = require("./brand");
const cleanDocument = require("./cleanDoc");
const syncToNeo4j = require("./mongoToNeo4j");
//const analyzeSingleText = require("./sentiment");
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

// ─────────────────────────────────────────
// POST /api/youtube/search-channel
// Body: { channelId, max? }
// ─────────────────────────────────────────
app.post("/api/youtube/search-channel", async (req, res) => {
  let { channelId, search, max = 5, minSubscribers = 1000 } = req.body;

  if (!channelId && !search)
    return res.status(400).json({ error: "channelId or search is required" });

  const client = new MongoClient(CONFIG.uri);
  try {
    // ───── ค้นหา channelId จาก keyword / @handle ─────
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

    // ==================== BATCH SUBSCRIBER FILTER (ประหยัด Quota) ====================
    const MIN_SUBS = parseInt(minSubscribers) || 1000;
    const { google } = require('googleapis');
    const yt = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

    const uniqueChannelIds = [...new Set(videos.map(v => v.channelId).filter(Boolean))];

    console.log(`📊 Checking ${uniqueChannelIds.length} unique channels (min ${MIN_SUBS} subs)`);

    const batchSize = 50;
    const channelSubsMap = new Map();

    for (let i = 0; i < uniqueChannelIds.length; i += batchSize) {
      const batchIds = uniqueChannelIds.slice(i, i + batchSize);

      try {
        const response = await yt.channels.list({
          part: 'statistics',
          id: batchIds.join(','),
          fields: 'items(id,statistics/subscriberCount)',
          maxResults: 50
        });

        (response.data.items || []).forEach(item => {
          const subs = parseInt(item.statistics?.subscriberCount || '0');
          channelSubsMap.set(item.id, subs);
        });

        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed (${batchIds.length} channels)`);
      } catch (err) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} error:`, err.message);
      }

      if (i + batchSize < uniqueChannelIds.length) {
        await new Promise(r => setTimeout(r, 250)); // พักเล็กน้อย
      }
    }

    // ==================== PROCESS VIDEOS ====================
    const limit = pLimit(2);   // วิเคราะห์พร้อมกันสูงสุด 2 คลิป

    const results = await Promise.all(
      videos.map(v =>
        limit(async () => {
          try {
            const subscriberCount = channelSubsMap.get(v.channelId) || 0;

            if (subscriberCount < MIN_SUBS) {
              console.log(`⏭️ Skip "${v.title}" — only ${subscriberCount} subscribers`);
              return {
                videoId: v.videoId,
                title: v.title,
                subscribers: subscriberCount,
                skipped: true,
                reason: "subscribers_below_minimum"
              };
            }

            console.log(`✅ Passed: ${v.authorName} (${subscriberCount} subs) → Analyzing`);

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
                return { videoId: v.videoId, title: v.title, brand: "No Brand", skipped: true };
              }

              finalAnalysis = {
                brand: analysis.brand || "No Brand",
                productType: analysis.productType || "None",
                category: analysis.category || "None",
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
                  subscribers: subscriberCount,        // ← บันทึกจำนวน subscriber
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
                  lastUpdate: new Date(),
                },
                $addToSet: { comments: { $each: v.comments || [] } },
              },
              { upsert: true }
            );

            await cleanDocument(col, v.videoId);

            return {
              videoId: v.videoId,
              title: v.title,
              subscribers: subscriberCount,
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
    syncToNeo4j().catch(e => console.error('❌ Neo4j sync error:', e.message));

    const passedCount = results.filter(r => !r.skipped || r.reason !== "subscribers_below_minimum").length;

    res.json({
      message: `✅ Processed ${results.length} videos (${passedCount} passed subscriber filter)`,
      totalFound: videos.length,
      passedFilter: passedCount,
      minSubscribers: MIN_SUBS,
      results,
    });

  } catch (err) {
    console.error("🚨 search-channel error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

// ─────────────────────────────────────────
// POST /api/youtube/sync-neo4j
// ─────────────────────────────────────────
app.post("/api/youtube/sync-neo4j", async (req, res) => {
  try {
    await syncToNeo4j();
    res.json({ message: "✅ Neo4j sync complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/youtube/data
// Query: ?authorName=xxx / ?brand=xxx / ?category=xxx
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET /api/youtube/health
// ─────────────────────────────────────────
app.get("/api/youtube/health", (req, res) => {
  res.json({ status: "ok", service: "youtube-backend", port: PORT });
});
// ─────────────────────────────────────────
// GET /api/last-updated  (ค้นหาล่าสุด)
// ดึงจาก lastUpdate field ของ document ล่าสุดใน youtuber collection
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET /api/last-refreshed  (อัพเดตยอดล่าสุด)
// ดึงจาก lastUpdate เหมือนกัน (YouTube ไม่มี lastSynced แยก)
// ─────────────────────────────────────────
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
// POST /api/youtube/analyze-sentiment
// Body: { videoId }        → วิเคราะห์ comments ของวิดีโอนั้น
//   หรือ { influencerName } → วิเคราะห์ทุก comment ของ influencer นั้น
//
// Logic:
//   1. ดึง documents จาก `comments` collection ที่ sentiment === null
//   2. วิเคราะห์ทีละ comment ผ่าน sentiment.py (concurrent 3 คัน)
//   3. $set sentiment + confidence กลับลง document เดิม
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/youtube/analyze-sentiment", async (req, res) => {
  const { videoId, influencerName } = req.body;
 
  if (!videoId && !influencerName)
    return res.status(400).json({ error: "videoId or influencerName is required" });
 
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
 
    // ใช้ comments collection (ไม่ใช่ youtuber)
    const commentCol = client.db(CONFIG.db).collection("comments");
 
    // ─── หา comments ที่ยังไม่ได้วิเคราะห์ ───
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
 
    //const limit = pLimit(3);   // วิเคราะห์พร้อมกัน 3 comment
    let success = 0, failed = 0;
 
    // ในส่วน Promise.all ของเดิม
    const limit = pLimit(10); // เพิ่ม Concurrency ได้มากขึ้นเพราะ Python ไม่ต้องโหลดโมเดลซ้ำแล้ว

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
                    sentiment: result.sentiment, // จะได้ POSITIVE/NEUTRAL/NEGATIVE
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
    console.error("🚨 analyze-sentiment error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});
 
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/sentiment-summary
// Query: ?influencerName=xxx   → สรุป sentiment ของ influencer
//     หรือ ?videoId=xxx         → สรุป sentiment ของวิดีโอนั้น
//
// คืน: positive / neutral / negative count + percent + avgConfidence
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/youtube/sentiment-summary", async (req, res) => {
  const { influencerName, videoId, videoIds } = req.query;
 
  if (!influencerName && !videoId && !videoIds)
    return res.status(400).json({ error: "influencerName or videoId is required" });
 
  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const commentCol = client.db(CONFIG.db).collection("comments");
 
    const match = { platform: "youtube", sentiment: { $ne: null } };
    // 1. จัดการเรื่อง Video Filter
    if (videoIds && videoIds.trim() !== "") {
        // กรณีระบุหลายวิดีโอ (ตามแบรนด์)
        const ids = videoIds.split(',').filter(id => id.trim() !== "");
        match.videoId = { $in: ids };
    } else if (videoId) {
        // กรณีระบุวิดีโอเดียว
        match.videoId = videoId;
    } else if (influencerName) {
        // กรณีดูภาพรวมทั้งอินฟลู (ไม่มีการกรองวิดีโอ)
        match.influencerName = new RegExp(influencerName, "i");
    }
 
    // aggregate: group by sentiment, นับ count + avg confidence
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
      dominantSentiment: dominant,
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
// วางใน youtubeServer.js (port 5001)
//
// GET /api/youtube/comment-samples
// Query: ?influencerName=xxx&brand=xxx&limit=3
//
// Logic:
//   1. หา videoId ทั้งหมดของอินฟลูคนนี้ที่ brand ตรงกัน จาก `youtuber` collection
//   2. ดึง comments จาก `comments` collection ที่ videoId อยู่ในกลุ่มนั้น + มี sentiment
//   3. แบ่งกลับเป็น positive / neutral / negative
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/youtube/comment-samples", async (req, res) => {
  const { influencerName, brand, limit = 3 } = req.query;

  if (!influencerName || !brand)
    return res.status(400).json({ error: "influencerName and brand are required" });

  const client = new MongoClient(CONFIG.uri);
  try {
    await client.connect();
    const db         = client.db(CONFIG.db);
    const youtuberCol = db.collection("youtuber");
    const commentCol  = db.collection("comments");

    // Step 1: หา videoId ที่ตรงกับ influencer + brand
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

    const sampleLimit = parseInt(limit);

    // Step 2: ดึง comment samples แยกตาม sentiment
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
    console.error("❌ comment-samples error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});