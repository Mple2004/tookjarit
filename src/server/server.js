// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Influencer = require('./Influencer');
const { ApifyClient } = require('apify-client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./User');
const SearchHistory = require('./SearchHistory');
const axios = require('axios'); //mp
const Campaign = require('./Campaign');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');       // ✅ NEW: สำหรับ reset token
const nodemailer = require('nodemailer'); // ✅ NEW: สำหรับส่ง email

const JWT_SECRET = process.env.JWT_SECRET || 'tookjarit-secret-key-2024';


const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const YOUTUBE_SERVICE = process.env.YOUTUBE_SERVICE_URL || 'http://localhost:5001';

// --- Setup Clients ---
const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const apifyRefreshClient = new ApifyClient({ token: process.env.APIFY_REFRESH_TOKEN || process.env.APIFY_API_TOKEN });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);
// ✅ เพิ่ม — YouTube (local)
const driverYoutube = neo4j.driver(
    'neo4j://localhost:7687',
    neo4j.auth.basic(
        process.env.NEO4J_YT_USER || 'neo4j',
        process.env.NEO4J_YT_PASSWORD || 'Aree2547!'
    )
);

// MongoDB Connection
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb+srv://tookjaritdev:113333555555@tookjarit-cluster.ve5cpue.mongodb.net/tookjarit?appName=TookJaRit-Cluster";
        await mongoose.connect(uri);
        console.log('✅ MongoDB Connected!');
    } catch (err) {
        console.error('❌ MongoDB Failed:', err.message);
        process.exit(1);
    }
};
connectDB();

// --- Helper ---
const getDisplayBrand = (brand, productType) => {
    if (!brand || ['Unknown', 'No Brand', 'No Brand Name'].includes(brand)) {
        return productType || "General Product";
    }
    return brand;
};


// ── STEP 2: แทนที่ /api/search-tiktok ทั้งหมดด้วยอันนี้ ────────
app.post('/api/search-tiktok', async (req, res) => {
    const { keyword, limit = 10 } = req.body;
    if (!keyword) return res.status(400).json({ error: "Keyword is required" });
    console.log(`🔎 TikTok Search: ${keyword}`);
    try {
        let input;
        if (keyword.startsWith('@')) {
            input = { profiles: [keyword.replace('@', '')], resultsPerPage: limit, shouldDownloadCovers: false, shouldDownloadSlideshowImages: false, searchSection: "" };
        } else {
            input = { hashtags: [keyword.replace('#', '')], resultsPerPage: limit, shouldDownloadCovers: false, shouldDownloadSlideshowImages: false, searchSection: "" };
        }
        const run = await apifyClient.actor("clockworks/free-tiktok-scraper").call(input);
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        if (!items || items.length === 0) return res.status(404).json({ message: "ไม่พบข้อมูลจาก TikTok" });

        const dataForAI = items.map(item => ({ id: item.id, text: item.text, author_name: item.authorMeta?.name || "Unknown" }));
        const prompt = `Analyze TikTok captions. Input: ${JSON.stringify(dataForAI)}
        Tasks:
        1. brand: Extract Brand Name (if specific brand is not found, use "No Brand").
        2. product_type: Identify the specific object (e.g., "Art Toy", "Serum", "Baby Stroller") and **Translate to Thai**.
        3. main_category: Choose ONE best category from this list based on these definitions: 
           - Fashion (Clothing, Vintage, Oversize, Streetwear, Watches, Jewelry)
           - Beauty & Personal Care (Skincare, Makeup, Perfume, Shampoo, Soap, Toothpaste)
           - Health & Wellness (Supplements, Vitamins, Fitness Equipment, Medicine)
           - Food & Beverage (Snacks, Coffee, Tea, Dried Food, Fresh Fruit, Clean Food)
           - Mom & Kids (Baby Products, Baby Toys, Maternity items)
           - IT & Gadgets (Phone Accessories, Bluetooth Headphones, Chargers, Smart Home)
           - Home & Living (Furniture, Minimalist Decor, Kitchenware, Air Fryer, Eco-friendly items)
           - Toys & Collectibles (Art Toy, Blind Box, Figures, Board Games)
           - Pet (Pet Food, Pet Toys, Pet Care)
           - Automotive (Car Accessories, Care products)
           - Lifestyle (DIY, Handmade, Travel, Vlog, Daily Life, Random stuff)
        Output: JSON Array ONLY. No markdown. Preserve "id".
        Structure: [{ "id": "...", "brand": "...", "product_type": "...", "main_category": "..." }]`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const aiAnalysis = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());

        const processedData = items.map(item => {
            const analysis = aiAnalysis.find(a => a.id === item.id) || {};
            return {
                videoId: item.id, authorName: item.authorMeta?.name || "Unknown",
                authorAvatar: item.authorMeta?.avatar || "", followers: item.authorMeta?.fans || 0,
                platform: 'tiktok', caption: item.text || "", videoUrl: item.webVideoUrl || "",
                textLanguage: item.textLanguage || '',
                totalViews: item.playCount || 0, totalLikes: item.diggCount || 0,
                totalComments: item.commentCount || 0, totalShares: item.shareCount || 0,
                brand: analysis.brand || "Unknown", productType: analysis.product_type || "Unknown",
                category: analysis.main_category || "Lifestyle"
            };
        });

        // บันทึก MongoDB
        try { await Influencer.insertMany(processedData, { ordered: false }); } catch (e) { if (e.code !== 11000) console.error(e); }

        // ✅ Auto sync → Neo4j ทันที (ไม่ต้องกดปุ่ม Sync อีกต่อไป)
        const session = driver.session();
        try {
            await session.run(`
                UNWIND $batch AS row
                MERGE (i:Influencer {name: row.authorName})
                ON CREATE SET i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform
                ON MATCH SET  i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform
                MERGE (b:Brand {name: row.finalBrand})
                ON CREATE SET b.category = row.category
                ON MATCH SET  b.category = row.category
                MERGE (i)-[r:POSTED_ABOUT]->(b)
                ON CREATE SET r.weight = 1, r.totalViews = row.totalViews, r.totalLikes = row.totalLikes
                ON MATCH SET  r.weight = r.weight + 1, r.totalViews = COALESCE(r.totalViews,0) + row.totalViews, r.totalLikes = COALESCE(r.totalLikes,0) + row.totalLikes
            `, { batch: processedData.map(d => ({ ...d, finalBrand: getDisplayBrand(d.brand, d.productType) })) });
        } finally { await session.close(); }

        // ✅ บันทึกเวลาอัปเดตล่าสุด
        await SearchHistory.findOneAndUpdate(
            { keyword, platform: 'tiktok' },
            { lastSearched: new Date() },
            { upsert: true, new: true }
        );

        res.json({ message: `บันทึก ${processedData.length} รายการเรียบร้อย` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STEP 3: เพิ่ม endpoint นี้ (วางก่อน app.listen) ─────────────
// GET /api/last-updated?platform=tiktok
app.get('/api/last-updated', async (req, res) => {
    const platform = req.query.platform || 'tiktok';
    try {
        // ลองหาจาก SearchHistory ก่อน
        const fromHistory = await SearchHistory
            .findOne({ platform })
            .sort({ lastSearched: -1 })
            .lean();

        if (fromHistory) {
            return res.json({ lastUpdated: fromHistory.lastSearched });
        }

        // ถ้าไม่มี SearchHistory ให้ fallback ไปดู updatedAt ล่าสุดใน Influencer
        const fromInfluencer = await Influencer
            .findOne({ platform })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .lean();

        res.json({ lastUpdated: fromInfluencer?.updatedAt || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────
// API: Graph Data (รองรับ platform filter)
// ─────────────────────────────────────────
app.get('/api/graph-data', async (req, res) => {
    const platform = req.query.platform || 'tiktok';
    // ✅ ถ้า thaiOnly → หา influencer ที่มีโพสต์ภาษาไทยจาก MongoDB
    const thaiOnly = req.query.thaiOnly === 'true';
     // ✅ เลือก driver ตาม platform
    const selectedDriver = platform === 'youtube' ? driverYoutube : driver;
    const session = selectedDriver.session();
    try {
        // เช็ค 2 เงื่อนไข: textLanguage = 'th' หรือ caption มีตัวอักษรไทย
        let thaiInfluencerNames = null;
        if (thaiOnly) {
            const thaiRegex = /[\u0E00-\u0E7F]/;  // ตัวอักษรไทย ก-๙
            const allInfluencers = await Influencer.find({ platform }).select('authorName textLanguage caption').lean();
            const thaiNames = allInfluencers
                .filter(inf => inf.textLanguage === 'th' || thaiRegex.test(inf.caption || ''))
                .map(inf => inf.authorName);
            thaiInfluencerNames = new Set(thaiNames);
        }

        const result = await session.run(`
            MATCH (i:Influencer)-[r]->(b:Brand)
            WHERE i.platform = $platform
            AND type(r) IN ['POSTED_ABOUT', 'PROMOTES']
            RETURN i, r, b
            LIMIT 1000
        `, { platform });

        const nodes = [], links = [], seen = new Set();
        const influencerStats = {}; // เก็บ stats แยกก่อน

        result.records.forEach(rec => {
            const i = rec.get('i');
            const b = rec.get('b');
            const r = rec.get('r');
            const iId = i.elementId;
            // ✅ thaiOnly → ข้ามถ้า influencer ไม่มีโพสต์ไทย
            if (thaiInfluencerNames && !thaiInfluencerNames.has(i.properties.name)) return;

            const rViews    = r.properties.totalViews?.low    ?? r.properties.totalViews    ?? 0;
            const rLikes    = r.properties.totalLikes?.low    ?? r.properties.totalLikes    ?? 0;
            const rComments = r.properties.totalComments?.low ?? r.properties.totalComments ?? 0;
            const rShares   = r.properties.totalShares?.low   ?? r.properties.totalShares   ?? 0;

            if (!influencerStats[iId]) influencerStats[iId] = { totalLikes: 0, totalViews: 0 };
            influencerStats[iId].totalLikes += parseInt(r.properties.totalLikes) || 0;
            influencerStats[iId].totalViews += parseInt(r.properties.totalViews) || 0;
            if (!seen.has(iId)) {
                nodes.push({
                    id: iId,
                    name: i.properties.name,
                    type: 'Influencer',
                    followers: parseInt(i.properties.subscribers) || parseInt(i.properties.followers) || 0,
                    subscribers: parseInt(i.properties.subscribers),
                    channelViews: parseInt(i.properties.channelViews) || 0, // ✅ เพิ่ม
                    authorAvatar: i.properties.authorAvatar || '',
                    platform: i.properties.platform || platform,
                });
                seen.add(iId);
            }
            if (!seen.has(b.elementId)) {
                nodes.push({
                    id: b.elementId,
                    name: b.properties.name,
                    type: 'Brand',
                    category: b.properties.category,
                });
                seen.add(b.elementId);
            }
            links.push({
                source: iId,
                target: b.elementId,
                weight: r.properties.weight?.low ?? r.properties.weight ?? 1,
                totalViews: parseInt(r.properties.totalViews) || 0,
                totalLikes: parseInt(r.properties.totalLikes) || 0,
            });
        });

        // ✅ inject totalLikes + totalViews เข้า influencer node
        nodes.forEach(node => {
            if (node.type === 'Influencer' && influencerStats[node.id]) {
                node.totalLikes = influencerStats[node.id].totalLikes;
                node.totalViews = influencerStats[node.id].totalViews;
            }
        });

        res.json({ nodes, links });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});


// ─────────────────────────────────────────
// API: Sync MongoDB → Neo4j
// ─────────────────────────────────────────
app.get('/api/sync-mongo-to-neo4j', async (req, res) => {
    try {
        const influencers = await Influencer.find({});
        const session = driver.session();
        try {
            await session.run(`
                UNWIND $batch AS row
                MERGE (i:Influencer {name: row.authorName})
                ON CREATE SET i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform
                ON MATCH SET  i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform
                MERGE (b:Brand {name: row.finalBrand})
                ON CREATE SET b.category = row.category
                ON MATCH SET  b.category = row.category
                MERGE (i)-[r:POSTED_ABOUT]->(b)
                ON CREATE SET r.weight = 1, r.totalViews = row.totalViews, r.totalLikes = row.totalLikes
                ON MATCH SET  r.weight = r.weight + 1, r.totalViews = COALESCE(r.totalViews,0) + row.totalViews, r.totalLikes = COALESCE(r.totalLikes,0) + row.totalLikes
            `, { batch: influencers.map(inf => ({ authorName: inf.authorName, authorAvatar: inf.authorAvatar || "", followers: inf.followers || 0, platform: inf.platform || 'tiktok', totalViews: inf.totalViews || 0, totalLikes: inf.totalLikes || 0, finalBrand: getDisplayBrand(inf.brand, inf.productType), category: inf.category })) });
            res.json({ status: "success", count: influencers.length });
        } finally { await session.close(); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// Auth Middleware
// ─────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อน' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' }); }
};

// ─────────────────────────────────────────
// POST /api/search-youtube  →  YouTube service: POST /api/youtube/search-channel
// ─────────────────────────────────────────
app.post('/api/search-youtube', authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(
      `${YOUTUBE_SERVICE}/api/youtube/search-channel`,
      req.body,
      { timeout: 300000 } // 5 นาที (AI วิเคราะห์นาน)
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error || err.message;
    console.error('❌ YouTube service error:', message);
    res.status(status).json({ error: message });
  }
});

// POST /api/youtube-sync-neo4j  →  YouTube service: POST /api/youtube/sync-neo4j
app.post('/api/youtube-sync-neo4j', authMiddleware, async (req, res) => {
  try {
    const response = await axios.post(
      `${YOUTUBE_SERVICE}/api/youtube/sync-neo4j`,
      {},
      { timeout: 120000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

// GET /api/youtube/data  →  YouTube service: GET /api/youtube/data
app.get('/api/youtube/data', async (req, res) => {
  try {
    const response = await axios.get(
      `${YOUTUBE_SERVICE}/api/youtube/data`,
      { params: req.query, timeout: 30000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

// GET /api/youtube/health  →  ตรวจสอบ YouTube service ยังทำงานอยู่ไหม
app.get('/api/youtube/health', async (req, res) => {
  try {
    const response = await axios.get(
      `${YOUTUBE_SERVICE}/api/youtube/health`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (err) {
    res.status(503).json({ status: 'offline', error: err.message });
  }
});

// ─────────────────────────────────────────
// API: Auth
// ─────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ' });
        if (await User.findOne({ email })) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
        const user = await User.create({ name, email, password });
        const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'ไม่พบอีเมลนี้ในระบบ' });
        if (!user.password) return res.status(400).json({ message: 'บัญชีนี้ใช้ Google Login กรุณาเข้าสู่ระบบด้วย Google' });
        if (!(await user.comparePassword(password))) return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
        const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────
// API: Google Login
// ─────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'ไม่พบข้อมูล Google' });
    try {
        // Decode Google JWT token
        const decoded = JSON.parse(Buffer.from(credential.split('.')[1], 'base64').toString());
        const { sub: googleId, email, name, picture } = decoded;

        if (!email) return res.status(400).json({ message: 'ไม่สามารถดึงอีเมลจาก Google ได้' });

        // หา user หรือสร้างใหม่
        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        if (user) {
            // อัพเดต googleId ถ้ายังไม่มี
            if (!user.googleId) { user.googleId = googleId; await user.save(); }
        } else {
            // สร้าง user ใหม่ (ไม่มี password)
            user = await User.create({ name, email, googleId });
        }

        const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (e) {
        console.error('❌ Google login error:', e.message);
        res.status(500).json({ message: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ' });
    }
});

// ─────────────────────────────────────────
// API: Forgot Password (ส่ง email reset link)
// ─────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'กรุณากรอกอีเมล' });
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'ไม่พบอีเมลนี้ในระบบ' });
        if (!user.password && user.googleId) return res.status(400).json({ message: 'บัญชีนี้ใช้ Google Login ไม่จำเป็นต้อง reset รหัสผ่าน' });

        // สร้าง reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 นาที
        await user.save();

        // ส่ง email
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/reset-password/${resetToken}`;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"TookJaRit" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: '🔑 รีเซ็ตรหัสผ่าน TookJaRit',
            html: `
                <div style="font-family: 'Prompt', sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #fff; border-radius: 16px; border: 1px solid #f0f0f0;">
                    <h2 style="color: #1a1a2e; margin-bottom: 10px;">🔑 รีเซ็ตรหัสผ่าน</h2>
                    <p style="color: #666; font-size: 14px;">คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี TookJaRit</p>
                    <a href="${resetUrl}" style="display: inline-block; margin: 20px 0; padding: 14px 32px; background: #ff4757; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px;">ตั้งรหัสผ่านใหม่</a>
                    <p style="color: #999; font-size: 12px;">ลิงก์นี้จะหมดอายุใน 30 นาที</p>
                    <p style="color: #ccc; font-size: 11px; margin-top: 20px;">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
                </div>
            `,
        });

        console.log(`📧 Reset email sent to ${email}`);
        res.json({ message: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว' });
    } catch (e) {
        console.error('❌ Forgot password error:', e.message);
        res.status(500).json({ message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่' });
    }
});

// ─────────────────────────────────────────
// API: Reset Password (ตั้งรหัสผ่านใหม่)
// ─────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    if (password.length < 6) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) return res.status(400).json({ message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอรีเซ็ตใหม่' });

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        console.log(`✅ Password reset for ${user.email}`);
        res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
    } catch (e) {
        console.error('❌ Reset password error:', e.message);
        res.status(500).json({ message: e.message });
    }
});

// ─────────────────────────────────────────
// API: Favorites
// ─────────────────────────────────────────
app.post('/api/favorites/toggle', authMiddleware, async (req, res) => {
    try {
        const { influencerName, platform = 'tiktok' } = req.body; // ✅ รับ platform
        const user = await User.findById(req.user.id);
        const idx = user.favorites.findIndex(f => f.influencerName === influencerName);
        if (idx === -1) {
            user.favorites.push({ influencerName, platform }); // ✅ บันทึก platform
            await user.save();
            res.json({ favorited: true, message: `เพิ่ม ${influencerName} แล้ว` });
        } else {
            user.favorites.splice(idx, 1);
            await user.save();
            res.json({ favorited: false, message: `ลบ ${influencerName} แล้ว` });
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('favorites name');
        res.json({ favorites: user.favorites, name: user.name });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ─────────────────────────────────────────
// API: Avatar
// ─────────────────────────────────────────
app.get('/api/avatar/:name', async (req, res) => {
    // try {
    //     const inf = await Influencer.findOne({ authorName: req.params.name }).select('authorAvatar').lean();
    //     res.json({ avatar: inf?.authorAvatar || null });
    // } catch (e) { res.status(500).json({ avatar: null }); }
    const { platform = 'tiktok' } = req.query;
    try {
        if (platform === 'youtube') {
            // ✅ ดึงจาก YouTube service
            const response = await axios.get(
                `${YOUTUBE_SERVICE}/api/youtube/data`,
                { params: { authorName: req.params.name, limit: 1 }, timeout: 5000 }
            );
            const doc = response.data?.data?.[0];
            return res.json({ avatar: doc?.authorAvatar || null });
        }
        // TikTok เหมือนเดิม
        const inf = await Influencer.findOne({ authorName: req.params.name })
            .select('authorAvatar').lean();
        res.json({ avatar: inf?.authorAvatar || null });
    } catch (e) {
        res.status(500).json({ avatar: null });
    }
});

// ─────────────────────────────────────────
// API: Export to Excel (พร้อม filter)
// แทนที่ /api/export-excel เดิมใน server.js
// ─────────────────────────────────────────
// npm install exceljs  (ถ้ายังไม่ได้ติดตั้ง)

app.get('/api/export-excel', async (req, res) => {
    const ExcelJS = require('exceljs');

    const {
        platform   = 'tiktok',
        dataType   = 'both',
        categories = '',
        keyword    = '',
    } = req.query;

    try {
        const buildQuery = (platformFilter) => {
            const q = { platform: platformFilter };
            if (categories) {
                const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
                if (catList.length > 0) q.category = { $in: catList };
            }
            if (keyword.trim()) {
                const kwList   = keyword.split(/[\s,]+/).map(k => k.trim()).filter(Boolean);
                const regexList = kwList.map(kw => new RegExp(kw, 'i'));
                q.$or = [
                    { authorName:  { $in: regexList } },
                    { brand:       { $in: regexList } },
                    { productType: { $in: regexList } },
                ];
            }
            return q;
        };
        const fetchYoutubeData = async () => {
        try {
            const params = { limit: 9999 };
            if (keyword.trim()) params.keyword = keyword.trim(); // service รับ keyword
            if (categories)     params.category = categories.split(',')[0]; // รับทีละ 1

            const ytRes = await axios.get(
                `${YOUTUBE_SERVICE}/api/youtube/data`,
                { params, timeout: 30000 }
            );
            let rows = ytRes.data?.data || [];

            // กรอง categories (หลาย cat) ฝั่งนี้
            if (categories) {
                const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
                rows = rows.filter(d => catList.includes(d.category));
            }
            // กรอง keyword ฝั่งนี้ (ครอบคลุมทุก field)
            if (keyword.trim()) {
                const kw = keyword.trim().toLowerCase();
                rows = rows.filter(d =>
                    (d.authorName   || '').toLowerCase().includes(kw) ||
                    (d.brand        || '').toLowerCase().includes(kw) ||
                    (d.productType  || '').toLowerCase().includes(kw)
                );
            }

            // ✅ Normalize YouTube fields ให้ตรงกับ TikTok columns
            return rows.map(d => ({
                authorName:    d.authorName    || '',
                followers:     d.subscribers   || 0,   // subscribers → followers
                brand:         d.brand         || '',
                productType:   d.productType   || '',
                category:      d.category      || '',
                caption:       d.caption       || d.title || '', // caption หรือ title
                totalViews:    d.totalViews    || 0,
                totalLikes:    d.totalLikes    || 0,
                totalComments: d.totalComments || 0,
                totalShares:   '-',                    // YouTube ไม่มี shares
                videoUrl:      d.url           || '',  // url → videoUrl
                platform:      'youtube',
            }));
        } catch (ytErr) {
            console.error('❌ YouTube export fetch error:', ytErr.message);
            return [];
        }};

        let tiktokData = [], youtubeData = [];
        if (platform === 'tiktok'   || platform === 'both') tiktokData  = await Influencer.find(buildQuery('tiktok')).lean();
        if (platform === 'youtube' || platform === 'both') {
            youtubeData = await fetchYoutubeData();
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'TookJaRit';
        workbook.created = new Date();

        const HEADER_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3436' } };
        const HEADER_FONT    = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        const BORDER_THIN    = {
            top:    { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left:   { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right:  { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
        const TIKTOK_ACCENT  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF010101' } };
        const YOUTUBE_ACCENT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        // ── Columns Tiktok — ไม่มี Avatar URL ──
        const COLUMNS = [
            { header: 'Author Name',    key: 'authorName',    width: 22 },
            { header: 'Followers',      key: 'followers',     width: 14 },
            { header: 'Brand',          key: 'brand',         width: 22 },
            { header: 'Product Type',   key: 'productType',   width: 24 },
            { header: 'Category',       key: 'category',      width: 20 },
            { header: 'Caption',        key: 'caption',       width: 50 },
            { header: 'Total Views',    key: 'totalViews',    width: 14 },
            { header: 'Total Likes',    key: 'totalLikes',    width: 14 },
            { header: 'Total Comments', key: 'totalComments', width: 16 },
            { header: 'Total Shares',   key: 'totalShares',   width: 14 },
            { header: 'Video URL',      key: 'videoUrl',      width: 40 },
            { header: 'Platform',       key: 'platform',      width: 12 },
        ];

        // YouTube columns 
        const YOUTUBE_COLUMNS = [
            { header: 'Author Name',    key: 'authorName',    width: 22 },
            { header: 'Subscribers',    key: 'followers',     width: 14 }, // label ต่างกัน
            { header: 'Brand',          key: 'brand',         width: 22 },
            { header: 'Product Type',   key: 'productType',   width: 24 },
            { header: 'Category',       key: 'category',      width: 20 },
            { header: 'Caption / Title',key: 'caption',       width: 50 },
            { header: 'Total Views',    key: 'totalViews',    width: 14 },
            { header: 'Total Likes',    key: 'totalLikes',    width: 14 },
            { header: 'Total Comments', key: 'totalComments', width: 16 },
            { header: 'Video URL',      key: 'videoUrl',      width: 40 },
            { header: 'Platform',       key: 'platform',      width: 12 },
        ];
        const NUMERIC_KEYS = ['followers', 'totalViews', 'totalLikes', 'totalComments', 'totalShares'];

        const buildSheet = (name, data, accentFill) => {
            if (data.length === 0) return;

            const sheet = workbook.addWorksheet(name, {
                views: [{ state: 'frozen', ySplit: 2 }],
                properties: { defaultRowHeight: 18 },
            });

            // Row 1: Title
            sheet.mergeCells(1, 1, 1, COLUMNS.length);
            const titleCell = sheet.getCell('A1');
            const filterDesc = [
                keyword    ? `keyword: "${keyword}"` : '',
                categories ? `categories: ${categories}` : '',
            ].filter(Boolean).join(' | ');
            titleCell.value = `TookJaRit — ${name}${filterDesc ? `  [${filterDesc}]` : ''}  |  ${new Date().toLocaleString('th-TH')}`;
            titleCell.font  = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            titleCell.fill  = accentFill;
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getRow(1).height = 26;

            // Row 2: Headers
            sheet.columns = COLUMNS;
            const headerRow = sheet.getRow(2);
            headerRow.values = COLUMNS.map(c => c.header);
            headerRow.eachCell(cell => {
                cell.font      = HEADER_FONT;
                cell.fill      = HEADER_FILL;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border    = BORDER_THIN;
            });
            headerRow.height = 22;

            // Rows 3+: Data (ไม่มี summary row)
            data.forEach((row, idx) => {
                const rowData = {};
                COLUMNS.forEach(col => { rowData[col.key] = row[col.key] ?? ''; });
                const r = sheet.addRow(rowData);

                const rowFill = idx % 2 === 0
                    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } }
                    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

                r.eachCell({ includeEmpty: true }, cell => {
                    cell.fill      = rowFill;
                    cell.border    = BORDER_THIN;
                    cell.font      = { name: 'Arial', size: 10 };
                    cell.alignment = { vertical: 'middle' };
                });

                NUMERIC_KEYS.forEach(key => {
                    const colIdx = COLUMNS.findIndex(c => c.key === key);
                    if (colIdx === -1) return;
                    const cell = r.getCell(colIdx + 1);
                    if (typeof row[key] === 'number') {
                        cell.numFmt    = '#,##0';
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                });
                r.height = 18;
            });

            sheet.autoFilter = {
                from: { row: 2, column: 1 },
                to:   { row: 2, column: COLUMNS.length }
            };
        };

        buildSheet('TikTok',  tiktokData,  TIKTOK_ACCENT);
        buildSheet('YouTube', youtubeData, YOUTUBE_ACCENT);

        // if (workbook.worksheets.length === 0) {
        //     return res.status(404).json({ error: 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขที่เลือก' });
        // }
        if (workbook.worksheets.length === 0) {
            return res.status(404).json({ 
                error: platform === 'youtube' 
                    ? 'ไม่พบข้อมูล YouTube — ตรวจสอบว่า YouTube service (port 5001) ทำงานอยู่'
                    : 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขที่เลือก'
            });
        }

        const filename = `TookJaRit_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error('Export Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// API: Sync Profile Stats (followers + profile likes จริง)
// วางใน server.js ก่อน app.listen(...)
// ─────────────────────────────────────────────────────────────
// ดึง heartCount (total likes บนโปรไฟล์จริง) + followerCount ล่าสุด
// จาก Apify แล้ว cache ลง MongoDB field: profileLikes, followers
// ─────────────────────────────────────────────────────────────

app.post('/api/sync-profile-stats', async (req, res) => {
    const { platform = 'tiktok' } = req.body;

    try {
        // 1. ดึง influencer ทั้งหมดของ platform นี้จาก MongoDB
        const influencers = await Influencer.distinct('authorName', { platform });
        if (!influencers.length) return res.json({ updated: 0, message: 'ไม่มี influencer ใน DB' });

        console.log(`🔄 Syncing ${influencers.length} ${platform} influencers...`);

        let updated = 0;
        const errors = [];

        // 2. batch scrape ทีละ 10 คน (ป้องกัน Apify rate limit)
        const BATCH = 10;
        for (let i = 0; i < influencers.length; i += BATCH) {
            const batch = influencers.slice(i, i + BATCH);

            try {
                let profileData = [];

                if (platform === 'tiktok') {
                    // Apify TikTok profile scraper
                    const run = await apifyClient.actor('clockworks/free-tiktok-scraper').call({
                        profiles:            batch.map(name => name.replace('@', '')),
                        resultsPerPage:      1,          // แค่ profile info ไม่ต้องดึง video
                        shouldDownloadCovers: false,
                        shouldDownloadSlideshowImages: false,
                        searchSection:       '',
                    });

                    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

                    // items จาก profile scrape มี authorMeta
                    const seen = new Set();
                    items.forEach(item => {
                        const name = item.authorMeta?.name;
                        if (!name || seen.has(name)) return;
                        seen.add(name);
                        profileData.push({
                            name,
                            followers:    item.authorMeta?.fans        || 0,
                            profileLikes: item.authorMeta?.heart       || 0,  // heartCount = total likes บน profile
                            avatar:       item.authorMeta?.avatar      || '',
                        });
                    });
                }

                // 3. อัพเดต MongoDB + Neo4j
                for (const p of profileData) {
                    if (!p.name) continue;

                    // อัพเดต MongoDB (ทุก record ของ influencer นี้)
                    await Influencer.updateMany(
                        { authorName: p.name, platform },
                        {
                            $set: {
                                followers:    p.followers,
                                profileLikes: p.profileLikes,
                                authorAvatar: p.avatar || undefined,
                                lastSynced:   new Date(),
                            }
                        }
                    );

                    // อัพเดต Neo4j node
                    const session = driver.session();
                    try {
                        await session.run(`
                            MATCH (i:Influencer {name: $name})
                            WHERE i.platform = $platform
                            SET i.followers    = $followers,
                                i.profileLikes = $profileLikes,
                                i.lastSynced   = $lastSynced
                        `, {
                            name:         p.name,
                            platform,
                            followers:    p.followers,
                            profileLikes: p.profileLikes,
                            lastSynced:   new Date().toISOString(),
                        });
                    } finally {
                        await session.close();
                    }

                    updated++;
                }

            } catch (batchErr) {
                console.error(`❌ Batch error (${batch.join(',')}):`, batchErr.message);
                errors.push(...batch);
            }

            // หน่วงระหว่าง batch ป้องกัน rate limit
            if (i + BATCH < influencers.length) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        res.json({
            message:  `✅ อัพเดต ${updated}/${influencers.length} influencer`,
            updated,
            total:    influencers.length,
            errors:   errors.length ? errors : undefined,
            syncedAt: new Date().toISOString(),
        });

    } catch (e) {
        console.error('❌ Sync Profile Stats Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// API: Get last sync time
// ─────────────────────────────────────────────────────────────
app.get('/api/sync-profile-stats/status', async (req, res) => {
    const { platform = 'tiktok' } = req.query;
    try {
        const latest = await Influencer
            .findOne({ platform, lastSynced: { $exists: true } })
            .sort({ lastSynced: -1 })
            .select('lastSynced')
            .lean();

        const total = await Influencer.distinct('authorName', { platform });
        const synced = await Influencer.distinct('authorName', {
            platform,
            profileLikes: { $exists: true, $gt: 0 }
        });

        res.json({
            lastSynced: latest?.lastSynced || null,
            totalInfluencers: total.length,
            syncedCount: synced.length,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── วางใน server.js ก่อน app.listen(...) ────────────────────────
// GET /api/top-videos-by-brand?authorName=xxx&platform=tiktok
// คืน: top video (likes สูงสุด) ของแต่ละแบรนด์ที่ influencer คนนี้โปรโมท
// ─────────────────────────────────────────────────────────────────
app.get('/api/top-videos-by-brand', async (req, res) => {
    const { authorName, platform = 'tiktok' } = req.query;
    if (!authorName) return res.status(400).json({ error: 'authorName is required' });

    try {
        // ✅ YouTube ดึงจาก YouTube service
        if (platform === 'youtube') {
            const response = await axios.get(
                `${YOUTUBE_SERVICE}/api/youtube/top-videos-by-brand`,
                { params: { authorName }, timeout: 10000 }
            );
            return res.json(response.data);
        }

        const results = await Influencer.aggregate([
            // 1. กรอง influencer + platform + ต้องมี videoUrl
            {
                $match: {
                    authorName,
                    platform,
                    videoUrl: { $exists: true, $ne: '' },
                }
            },
            // 2. เรียงจาก likes มากไปน้อย (เพื่อให้ $first ได้คลิปที่ดีสุด)
            { $sort: { totalLikes: -1 } },
            // 3. group by brand → เอาแค่ record แรก (likes สูงสุด) ของแต่ละแบรนด์
            {
                $group: {
                    _id:        '$brand',
                    brand:      { $first: '$brand' },
                    videoUrl:   { $first: '$videoUrl' },
                    totalLikes: { $first: '$totalLikes' },
                    totalViews: { $first: '$totalViews' },
                    caption:    { $first: '$caption' },
                    category:   { $first: '$category' },
                }
            },
            // 4. เรียงแบรนด์จาก likes มากไปน้อย
            { $sort: { totalLikes: -1 } },
            // 5. จำกัด 10 แบรนด์
            { $limit: 10 },
        ]);

        res.json(results);
    } catch (e) {
        console.error('❌ top-videos-by-brand error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────
// API: Import TikTok JSON (จากไฟล์ Apify ที่โหลดไว้)
// ─────────────────────────────────────────
app.post('/api/import-tiktok-json', async (req, res) => {
    const { items: rawItems, thaiOnly = false } = req.body;
    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ error: "กรุณาส่ง items array มาด้วย" });
    }
    console.log(`📥 Import TikTok JSON: ${rawItems.length} items | thaiOnly: ${thaiOnly}`);
    try {
        const items = thaiOnly ? rawItems.filter(item => item.textLanguage === 'th') : rawItems;
        if (items.length === 0) return res.status(404).json({ message: "ไม่พบโพสต์ภาษาไทยในไฟล์นี้" });

        const BATCH_SIZE = 15;
        let allAnalysis = [];
        for (let start = 0; start < items.length; start += BATCH_SIZE) {
            const batch = items.slice(start, start + BATCH_SIZE);
            const dataForAI = batch.map(item => ({ id: item.id, text: item.text, author_name: item.authorMeta?.name || "Unknown" }));
            const prompt = `Analyze TikTok captions. Input: ${JSON.stringify(dataForAI)}
            Tasks:
            1. brand: Extract Brand Name (if specific brand is not found, use "No Brand").
            2. product_type: Identify the specific object and **Translate to Thai**.
            3. main_category: Choose ONE best category from: Fashion, Beauty & Personal Care, Health & Wellness, Food & Beverage, Mom & Kids, IT & Gadgets, Home & Living, Toys & Collectibles, Pet, Automotive, Lifestyle
            Output: JSON Array ONLY. No markdown. Preserve "id".
            Structure: [{ "id": "...", "brand": "...", "product_type": "...", "main_category": "..." }]`;
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            const parsed = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());
            allAnalysis = allAnalysis.concat(parsed);
            console.log(`   🤖 Gemini batch ${Math.floor(start / BATCH_SIZE) + 1}: ${parsed.length} analyzed`);
        }

        const processedData = items.map(item => {
            const analysis = allAnalysis.find(a => a.id === item.id) || {};
            return {
                videoId: item.id, authorName: item.authorMeta?.name || "Unknown",
                authorAvatar: item.authorMeta?.avatar || "", followers: item.authorMeta?.fans || 0,
                profileLikes: item.authorMeta?.heart || 0,
                platform: 'tiktok', caption: item.text || "", videoUrl: item.webVideoUrl || "",
                textLanguage: item.textLanguage || '',
                totalViews: item.playCount || 0, totalLikes: item.diggCount || 0,
                totalComments: item.commentCount || 0, totalShares: item.shareCount || 0,
                brand: analysis.brand || "Unknown", productType: analysis.product_type || "Unknown",
                category: analysis.main_category || "Lifestyle"
            };
        });

        try { await Influencer.insertMany(processedData, { ordered: false }); }
        catch (e) { if (e.code !== 11000) console.error(e); }

        const session = driver.session();
        try {
            await session.run(`
                UNWIND $batch AS row
                MERGE (i:Influencer {name: row.authorName})
                ON CREATE SET i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform, i.profileLikes = row.profileLikes
                ON MATCH SET  i.followers = row.followers, i.authorAvatar = row.authorAvatar, i.platform = row.platform, i.profileLikes = row.profileLikes
                MERGE (b:Brand {name: row.finalBrand})
                ON CREATE SET b.category = row.category
                ON MATCH SET  b.category = row.category
                MERGE (i)-[r:POSTED_ABOUT]->(b)
                ON CREATE SET r.weight = 1, r.totalViews = row.totalViews, r.totalLikes = row.totalLikes, r.totalComments = row.totalComments, r.totalShares = row.totalShares
                ON MATCH SET  r.weight = r.weight + 1, r.totalViews = COALESCE(r.totalViews,0) + row.totalViews, r.totalLikes = COALESCE(r.totalLikes,0) + row.totalLikes, r.totalComments = COALESCE(r.totalComments,0) + row.totalComments, r.totalShares = COALESCE(r.totalShares,0) + row.totalShares
            `, { batch: processedData.map(d => ({ ...d, finalBrand: getDisplayBrand(d.brand, d.productType) })) });
        } finally { await session.close(); }

        console.log(`✅ Import done: ${processedData.length} items`);
        res.json({ message: `นำเข้า ${processedData.length} รายการสำเร็จ`, imported: processedData.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// API: Refresh Influencer Stats (อัพเดตยอด followers/likes/views จาก TikTok)
// ─────────────────────────────────────────
app.post('/api/refresh-stats', async (req, res) => {
    const { maxVideos = 100, staleDays = 30 } = req.body || {};
    const staleDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    console.log(`🔄 Refresh Stats | maxVideos: ${maxVideos} | staleDays: ${staleDays}`);

    try {
        // 1. หาคลิปที่ยังไม่เคย sync หรือ sync เกิน X วัน
        const staleVideos = await Influencer.find({
            platform: 'tiktok',
            videoUrl: { $exists: true, $ne: '' },
            $or: [
                { lastSynced: null },
                { lastSynced: { $lt: staleDate } },
            ]
        })
        .sort({ lastSynced: 1 })
        .limit(maxVideos)
        .select('videoUrl videoId authorName')
        .lean();

        if (staleVideos.length === 0) {
            return res.json({ message: 'ทุกคลิปอัพเดตแล้ว ไม่มีอะไรต้อง refresh', refreshed: 0 });
        }

        console.log(`   📋 พบ ${staleVideos.length} คลิปที่ต้องอัพเดต`);

        // 2. Scrape ด้วย postURLs — ตรง videoId 100%
        const BATCH_SIZE = 20;  // Apify รับ URL ได้หลายอันต่อ call
        let totalUpdated = 0;

        for (let i = 0; i < staleVideos.length; i += BATCH_SIZE) {
            const batch = staleVideos.slice(i, i + BATCH_SIZE);
            const postURLs = batch.map(v => v.videoUrl);

            console.log(`   🔎 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} URLs`);

            try {
                const input = {
                    postURLs,
                    resultsPerPage: 1,
                    shouldDownloadCovers: false,
                    shouldDownloadSlideshowImages: false,
                    shouldDownloadSubtitles: false,
                    shouldDownloadVideos: false,
                };
                const run = await apifyRefreshClient.actor("clockworks/free-tiktok-scraper").call(input);
                const { items } = await apifyRefreshClient.dataset(run.defaultDatasetId).listItems();

                if (!items || items.length === 0) {
                    console.log(`   ⚠️ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ไม่ได้ data`);
                    continue;
                }

                // 3. อัพเดต MongoDB — ยอดคลิป + followers/avatar
                for (const item of items) {
                    const authorName = item.authorMeta?.name;
                    if (!authorName) continue;

                    // อัพเดต followers/avatar ทุก record ของ influencer นี้
                    await Influencer.updateMany(
                        { authorName, platform: 'tiktok' },
                        {
                            $set: {
                                followers: item.authorMeta?.fans || 0,
                                profileLikes: item.authorMeta?.heart || 0,
                                authorAvatar: item.authorMeta?.avatar || '',
                                lastSynced: new Date(),
                            }
                        }
                    );

                    // อัพเดตยอดคลิปตรง videoId
                    if (item.id) {
                        await Influencer.updateOne(
                            { videoId: item.id, platform: 'tiktok' },
                            {
                                $set: {
                                    totalViews: item.playCount || 0,
                                    totalLikes: item.diggCount || 0,
                                    totalComments: item.commentCount || 0,
                                    totalShares: item.shareCount || 0,
                                    textLanguage: item.textLanguage || '',
                                }
                            }
                        );
                        totalUpdated++;
                    }
                }

                console.log(`   ✅ Batch done: ${items.length} items updated`);

            } catch (batchErr) {
                console.error(`   ❌ Batch error:`, batchErr.message);
            }
        }

        // 4. Sync ไป Neo4j
        if (totalUpdated > 0) {
            const updatedNames = [...new Set(staleVideos.map(v => v.authorName))];
            const freshData = await Influencer.find({
                authorName: { $in: updatedNames },
                platform: 'tiktok',
            });

            const session = driver.session();
            try {
                await session.run(`
                    UNWIND $batch AS row
                    MERGE (i:Influencer {name: row.authorName})
                    SET i.followers = row.followers, i.authorAvatar = row.authorAvatar,
                        i.profileLikes = row.profileLikes
                    WITH i, row
                    MERGE (b:Brand {name: row.finalBrand})
                    MERGE (i)-[r:POSTED_ABOUT]->(b)
                    SET r.totalViews = row.totalViews, r.totalLikes = row.totalLikes,
                        r.totalComments = row.totalComments, r.totalShares = row.totalShares
                `, {
                    batch: freshData.map(inf => ({
                        authorName: inf.authorName,
                        authorAvatar: inf.authorAvatar || '',
                        followers: inf.followers || 0,
                        profileLikes: inf.profileLikes || 0,
                        totalViews: inf.totalViews || 0,
                        totalLikes: inf.totalLikes || 0,
                        totalComments: inf.totalComments || 0,
                        totalShares: inf.totalShares || 0,
                        finalBrand: getDisplayBrand(inf.brand, inf.productType),
                    }))
                });
            } finally { await session.close(); }
        }

        console.log(`🔄 Refresh done: ${totalUpdated}/${staleVideos.length} clips updated`);
        res.json({
            message: `อัพเดตสำเร็จ ${totalUpdated} คลิป`,
            refreshed: totalUpdated,
            total: staleVideos.length,
        });

    } catch (e) {
        console.error('❌ Refresh error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────
// API: Last Refreshed (วันที่อัพเดตยอดล่าสุด)
// ─────────────────────────────────────────
app.get('/api/last-refreshed', async (req, res) => {
    const platform = req.query.platform || 'tiktok';
    try {
        const latest = await Influencer.findOne({ platform, lastSynced: { $ne: null } })
            .sort({ lastSynced: -1 })
            .select('lastSynced')
            .lean();
        res.json({ lastRefreshed: latest?.lastSynced || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5000;

const buildPath = path.join(__dirname, '..', '..', 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(buildPath, 'index.html'));
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));