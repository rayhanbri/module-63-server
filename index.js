const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

// Middleware to parse JSON
app.use(express.json());
app.use(cors());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eztfylz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const shiftsCollection = client.db("zapShiftDB").collection("parcelCollection");
     
        //  post data for parcel 

        app.post('/parcels', async (req, res) => {
            try {
                const parcel = req.body;
                const result = await parcelsCollection.insertOne(parcel);
                res.status(201).json(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to add parcel' });
            }
        });

        //  get data for parcel 

        app.get('/parcels', async (req, res) => {
            try {
                const parcels = await parcelsCollection.find().toArray();
                res.status(200).json(parcels);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch parcels' });
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// Example route
app.get('/', (req, res) => {
    res.send('Hello, Express server is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});