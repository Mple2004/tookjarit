require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const client = new MongoClient(process.env.Test_MONGODB);
    await client.connect();
    const col = client.db('InfluencerProject').collection('youtuber');

    // นับว่ามี field อะไรบ้าง
    const hasFollowers  = await col.countDocuments({ followers:  { $exists: true } });
    const hasSubscribe  = await col.countDocuments({ subscribe:  { $exists: true } });
    const hasSubscribers = await col.countDocuments({ subscribers: { $exists: true } });

    console.log(`followers field:   ${hasFollowers} docs`);
    console.log(`subscribe field:   ${hasSubscribe} docs`);
    console.log(`subscribers field: ${hasSubscribers} docs`);

    // ดู sample ที่มีค่าจริงๆ ไม่ใช่ 0
    const sample = await col.findOne({ 
        platform: 'youtube',
        $or: [
            { followers:   { $gt: 0 } },
            { subscribe:   { $gt: 0 } },
            { subscribers: { $gt: 0 } }
        ]
    });
    console.log('\nSample with actual value:', JSON.stringify(sample, null, 2));

    await client.close();
}
check();