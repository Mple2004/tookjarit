// src/server/Influencer.js  (หรือ src/models/Influencer.js)
const mongoose = require('mongoose');

const InfluencerSchema = new mongoose.Schema({
    // --- 👤 ข้อมูลส่วนตัว ---
    authorName:   { type: String, required: true },
    authorAvatar: { type: String, default: '' },
    followers:    { type: Number, default: 0 },
    profileLikes: { type: Number, default: 0 },   // ✅ NEW: Profile Likes จริงจาก TikTok
    lastSynced:   { type: Date,   default: null }, // ✅ NEW: วันที่ sync ล่าสุด
    platform:     { type: String, default: 'tiktok' },

    // --- 📝 ข้อมูลคอนเทนต์ ---
    videoId:   { type: String },
    caption:   { type: String, default: '' },
    videoUrl:  { type: String, default: '' },

    // --- 📊 Metrics ---
    totalViews:    { type: Number, default: 0 },
    totalLikes:    { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },
    totalShares:   { type: Number, default: 0 },

    // --- 🏷️ สินค้าและหมวดหมู่ ---
    brand:       { type: String, default: '' },
    productType: { type: String, default: '' },
    category:    { type: String, default: '' },

    updatedAt: { type: Date, default: Date.now }
});

InfluencerSchema.index({ videoId: 1, platform: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Influencer', InfluencerSchema);
