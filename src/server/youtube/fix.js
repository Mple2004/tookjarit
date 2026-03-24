require('dotenv').config();
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');

const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fix() {
    const client = new MongoClient(process.env.Test_MONGODB);
    await client.connect();
    const col = client.db('InfluencerProject').collection('youtuber');

    // ✅ ดึงเฉพาะที่ไม่มี avatar หรือ avatar ว่าง
    const authors = await col.distinct('authorName', { 
        platform: 'youtube',
        $or: [
            { authorAvatar: { $exists: false } },
            { authorAvatar: '' },
            { authorAvatar: null }
        ]
    });
    console.log(`🔍 พบ ${authors.length} channels ที่ไม่มี avatar`);

    let updated = 0;
    for (const name of authors) {
        try {
            // ✅ ดึง videoId จาก MongoDB
            const doc = await col.findOne({ 
                authorName: name, 
                platform: 'youtube', 
                videoId: { $exists: true } 
            });
            
            if (!doc?.videoId) { 
                console.log(`⚠️ ไม่มี videoId: ${name}`); 
                continue; 
            }

            // ✅ ดึง channelId จาก videoId
            const videoRes = await youtube.videos.list({
                part: 'snippet', id: doc.videoId
            });
            const snippet = videoRes.data.items?.[0]?.snippet;
            const channelId = snippet?.channelId;

            if (!channelId) { 
                console.log(`⚠️ ไม่พบ channelId: ${name}`); 
                continue; 
            }

            // ✅ ดึง stats + avatar จาก channelId จริง
            const chRes = await youtube.channels.list({
                part: 'snippet,statistics', id: channelId
            });
            const ch = chRes.data.items?.[0];
            const stats = ch?.statistics;
            const avatar = ch?.snippet?.thumbnails?.high?.url ||
                           ch?.snippet?.thumbnails?.medium?.url ||
                           ch?.snippet?.thumbnails?.default?.url || '';

            const subscribers = Number(stats?.subscriberCount) || 0;
            const channelViews = Number(stats?.viewCount) || 0;

            await col.updateMany(
                { authorName: name, platform: 'youtube' },
                { $set: { authorAvatar: avatar, subscribers, channelViews, channelId } }
            );

            console.log(`✅ ${name} | subs: ${subscribers} | views: ${channelViews} | avatar: ${avatar ? 'มี' : 'ไม่มี'}`);
            updated++;
            await sleep(300);
        } catch (err) {
            console.error(`❌ ${name}:`, err.message);
        }
    }

    console.log(`\n🎉 อัปเดต ${updated}/${authors.length} channels`);
    await client.close();
}

fix().catch(console.error);