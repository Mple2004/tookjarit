require('dotenv').config();
const { MongoClient } = require('mongodb');

function fixCategory(cat) {
    if (!cat) return 'Lifestyle';
    const map = {
        'Beauty Personal Care': 'Beauty & Personal Care',
        'Health Wellness':      'Health & Wellness',
        'Food Beverage':        'Food & Beverage',
        'Mom Kids':             'Mom & Kids',
        'IT Gadgets':           'IT & Gadgets',
        'Home Living':          'Home & Living',
        'Toys Collectibles':    'Toys & Collectibles',
    };
    return map[cat] || cat;
}

async function fix() {
    const client = new MongoClient(process.env.Test_MONGODB);
    await client.connect();
    const col = client.db('InfluencerProject').collection('youtuber');

    const docs = await col.find({ platform: 'youtube' }).toArray();
    let updated = 0;

    for (const doc of docs) {
        const fixed = fixCategory(doc.category);
        if (fixed !== doc.category) {
            await col.updateOne({ _id: doc._id }, { $set: { category: fixed } });
            console.log(`✅ ${doc.videoId} | "${doc.category}" → "${fixed}"`);
            updated++;
        }
    }

    console.log(`\n🎉 อัปเดต ${updated} docs`);
    await client.close();
}

fix().catch(console.error);