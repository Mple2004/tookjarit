require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.Test_MONGODB;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("InfluencerProject");

    const collection = database.collection("youtubers");

    //data
    const doc = { 
        name: "My First Data", 
        role: "Developer", 
        status: "Success",
        createdAt: new Date() 
    };
    //savedata
    const result = await collection.insertOne(doc);

    console.log(`✅ บันทึกข้อมูลสำเร็จ! ID: ${result.insertedId}`);
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);
