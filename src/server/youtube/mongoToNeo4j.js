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
    // แปลงเป็น Title Case เช่น "CATHY DOLL" → "Cathy Doll"
    return brand.trim()
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

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
    const db = mongoClient.db("InfluencerProject"); // สร้างตัวแปร db ไว้ใช้ซ้ำ
    const collection = db.collection("youtuber");

    const documents = await collection.find().toArray();

    const session = neoDriver.session();
    console.log(`🔗 Syncing ${documents.length} items to Neo4j...`);

    try {
      for (const doc of documents) {
        const branded = doc.brand?.trim();
        if (!branded || ['No Brand', 'no brand', 'None', 'none', 'No brand', ''].includes(branded)) continue;
        await session.run(`
          MERGE (i:Influencer {name: $name, platform: 'youtube'})
          SET i.subscribers = $subscribers,
              i.authorAvatar = $avatar,
              i.channelViews = $channelViews,
              i.platform = 'youtube',
              i.lastUpdate = datetime()

          MERGE (b:Brand {name: $brand})
          SET b.category = $category

          MERGE (i)-[r:POSTED_ABOUT]->(b)
          ON CREATE SET r.weight = 1,
                        r.totalViews = $views,
                        r.totalLikes = $likes,
                        r.totalComments = $comments,
                        r.totalShares = 0,
                        r.platform = 'youtube',
                        r.lastUpdate = datetime()
          ON MATCH SET  r.weight = r.weight + 1,
                        r.totalViews = r.totalViews + $views,
                        r.totalLikes = r.totalLikes + $likes,
                        r.totalComments = r.totalComments + $comments
        `, {
          name: doc.authorName,
          subscribers: parseInt(doc.subscribers) || 0,
          avatar: doc.authorAvatar || '',
          channelViews: parseInt(doc.channelViews) || 0,
          brand: normalizeBrand(branded),
          category: fixCategory(doc.category),
          views: neo4j.int(doc.totalViews || 0),
          likes: neo4j.int(doc.totalLikes || 0),
          comments: neo4j.int(doc.totalComments || 0),
        });

        await collection.updateOne(
          { _id: doc._id },
          { $set: { lastUpdate: new Date() } }
        );

        console.log(`✅ ${doc.authorName} → ${branded}`);
      }
    } finally {
        await session.close();
    }
  } catch (err) {
    console.error("🚨 Neo4j Sync Error:", err);
    throw err; // ส่ง error กลับให้ caller จัดการ
  } finally {
    await mongoClient.close();
    await neoDriver.close();
  }
}

// ✅ export ให้ index.js เรียกได้ + รันตรงได้เหมือนเดิม
if (require.main === module) {
  syncToNeo4j();
}

module.exports = syncToNeo4j;