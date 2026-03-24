require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const fetchChannelVideos = require("./chanel");
const analyzeVideo = require("./brand");
const cleanDocument = require("./cleanDoc");
const syncToNeo4j = require("./mongoToNeo4j");
const pLimit = require('p-limit');

const app = express();
app.use(express.json());

const CONFIG = {
  uri: process.env.Test_MONGODB,
  db: "InfluencerProject",
  collection: "youtuber",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
                    videoUrl:   { $first: '$url' }, // ✅ map url → videoUrl
                    channelId:  { $first: '$channelId' },
                    totalLikes: { $first: '$totalLikes' },
                    totalViews: { $first: '$totalViews' },
                    caption:    { $first: '$caption' },
                    category:   { $first: '$category' },
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