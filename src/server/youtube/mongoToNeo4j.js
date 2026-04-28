require("dotenv").config();
const { MongoClient } = require("mongodb");
const neo4j = require("neo4j-driver");

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

function normalizeBrand(brand) {
    if (!brand) return '';
    return brand.trim()
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ค่าที่ถือว่า "ไม่มีแบรนด์"
//const NO_BRAND_VALUES = new Set(['No Brand', 'no brand', 'None', 'none', 'No brand', '']);

// function isValidBrand(brand) {
//     return brand && !NO_BRAND_VALUES.has(brand.trim());
// }

async function syncToNeo4j() {
    const mongoClient = new MongoClient(process.env.Test_MONGODB);
    const neoDriver = neo4j.driver(
        process.env.NEO4J_URI || "neo4j://localhost:7687",
        neo4j.auth.basic(
            process.env.NEO4J_USER || "neo4j",
            process.env.NEO4J_PASSWORD || "Aree2547!"
        )
    );

    try {
        await mongoClient.connect();
        const db = mongoClient.db("InfluencerProject");
        const collection = db.collection("youtuber");
        const documents = await collection.find().toArray();
        const session = neoDriver.session();

        console.log(`🔗 Syncing ${documents.length} items to Neo4j...`);

        try {
            // ─────────────────────────────────────────────────
            // STEP 1: สร้าง Map videoId → { brand, influencer }
            //         จาก MongoDB (เฉพาะที่มีแบรนด์จริง)
            // ─────────────────────────────────────────────────
            const videoBrandMap = new Map();
            for (const doc of documents) {
                //if (!isValidBrand(doc.brand)) continue;
                videoBrandMap.set(doc.videoId, {
                    brand: normalizeBrand(doc.brand),
                    influencer: doc.authorName,
                });
            }
            console.log(`📦 Valid branded videos: ${videoBrandMap.size}`);

            // ─────────────────────────────────────────────────
            // STEP 2: ดึง relationship เก่าจาก Neo4j
            //         แล้วลบอันที่ brand เปลี่ยนไปแล้ว
            // ─────────────────────────────────────────────────
            const existingRels = await session.run(`
                MATCH (i:Influencer)-[r:POSTED_ABOUT]->(b:Brand)
                WHERE r.videoId IS NOT NULL
                RETURN i.name AS influencer, b.name AS brand, r.videoId AS videoId
            `);

            const toDelete = existingRels.records.filter(record => {
                const videoId    = record.get('videoId');
                const oldBrand   = record.get('brand');
                const correct    = videoBrandMap.get(videoId);
                // ลบถ้า: videoId นี้มีใน MongoDB และชื่อแบรนด์ไม่ตรงกัน
                return correct && correct.brand !== oldBrand;
            });

            if (toDelete.length > 0) {
                console.log(`🗑️ พบ ${toDelete.length} relationship ที่ brand เปลี่ยน → กำลังลบ...`);
                for (const record of toDelete) {
                    await session.run(`
                        MATCH (i:Influencer {name: $influencer})-[r:POSTED_ABOUT]->(b:Brand {name: $brand})
                        WHERE r.videoId = $videoId
                        DELETE r
                    `, {
                        influencer: record.get('influencer'),
                        brand:      record.get('brand'),
                        videoId:    record.get('videoId'),
                    });
                    console.log(`🗑️ ลบ: ${record.get('influencer')} → ${record.get('brand')} (${record.get('videoId')})`);
                }
            }

            // ─────────────────────────────────────────────────
            // STEP 3: MERGE ข้อมูลใหม่
            //         ใช้ videoId เป็น key ของ relationship
            //         SET แทน accumulate เพื่อกัน views บวกซ้ำ
            // ─────────────────────────────────────────────────
            for (const doc of documents) {
                //if (!isValidBrand(doc.brand)) continue;
                const normalizedBrand = normalizeBrand(doc.brand);

                await session.run(`
                    MERGE (i:Influencer {name: $name, platform: 'youtube'})
                    SET i.subscribers  = $subscribers,
                        i.authorAvatar = $avatar,
                        i.channelViews = $channelViews,
                        i.platform     = 'youtube',
                        i.lastUpdate   = datetime()

                    MERGE (b:Brand {name: $brand})
                    SET b.category = $category

                    MERGE (i)-[r:POSTED_ABOUT {videoId: $videoId}]->(b)
                    SET r.totalViews    = $views,
                        r.totalLikes    = $likes,
                        r.totalComments = $comments,
                        r.totalShares   = 0,
                        r.platform      = 'youtube',
                        r.lastUpdate    = datetime()
                `, {
                    name:         doc.authorName,
                    subscribers:  parseInt(doc.subscribers)  || 0,
                    avatar:       doc.authorAvatar            || '',
                    channelViews: parseInt(doc.channelViews) || 0,
                    brand:        normalizedBrand,
                    category:     fixCategory(doc.category),
                    videoId:      doc.videoId                 || '',
                    views:        neo4j.int(doc.totalViews    || 0),
                    likes:        neo4j.int(doc.totalLikes    || 0),
                    comments:     neo4j.int(doc.totalComments || 0),
                });

                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { lastUpdate: new Date() } }
                );

                console.log(`✅ ${doc.authorName} → ${normalizedBrand} (${doc.videoId})`);
            }

            // ─────────────────────────────────────────────────
            // STEP 4: ลบโหนด Brand ที่ไม่มี relationship เหลือ
            // ─────────────────────────────────────────────────
            const cleanupResult = await session.run(`
                MATCH (b:Brand)
                WHERE NOT EXISTS { MATCH ()-[:POSTED_ABOUT]->(b) }
                WITH collect(b) AS orphans
                FOREACH (b IN orphans | DETACH DELETE b)
                RETURN size(orphans) AS deleted
            `);

            const deleted = cleanupResult.records[0]?.get('deleted');
            if (deleted > 0) {
                console.log(`🗑️ ลบโหนด Brand ที่ไม่มี relationship แล้ว: ${deleted} โหนด`);
            }

            console.log("✅ Neo4j sync complete");

        } finally {
            await session.close();
        }

    } catch (err) {
        console.error("🚨 Neo4j Sync Error:", err);
        throw err;
    } finally {
        await mongoClient.close();
        await neoDriver.close();
    }
}

if (require.main === module) {
    syncToNeo4j();
}

module.exports = syncToNeo4j;