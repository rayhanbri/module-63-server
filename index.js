const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// eita dot env pore dhibho karon eita k dot env the rakbho amra 
//13 eita copy kore client side e jaw (/create-payment-intent),go to payment form 
const stripe = require('stripe')(process.env.Payment_Gateway_Key);
// 8. er pos tader website login kore  publishable key niye asbho and secret key niye asbho 
// 9.er por client er payment.jsx e jaw 
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

        const parcelsCollection = client.db("zapShift").collection("parcels");
        // Add this after your other collection declarations
        const paymentsCollection = client.db("zapShift").collection("payments");

        //  post data for parcel 

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            // console.log(parcel)
            const result = await parcelsCollection.insertOne(parcel);
            res.send(result)
        });

        // Get parcels by email query, newest first; if no email, return all
        app.get('/parcels', async (req, res) => {
            try {
                const email = req.query.email;
                const filter = email ? { created_by: email } : {};
                const parcels = await parcelsCollection
                    .find(filter)
                    .sort({ _id: -1 }) // newest first
                    .toArray();
                res.status(200).json(parcels);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch parcels' });
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

        // Find a parcel by id
        app.get('/parcels/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });
                if (parcel) {
                    res.status(200).json(parcel);
                } else {
                    res.status(404).json({ error: 'Parcel not found' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch parcel' });
            }
        });


        // Delete a parcel by id
        app.delete('/parcels/:id', async (req, res) => {
            try {
                const id = req.params.id;
                console.log(id)
                const result = await parcelsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 1) {
                    res.status(200).json({ message: 'Parcel deleted successfully' });
                } else {
                    res.status(404).json({ error: 'Parcel not found' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Failed to delete parcel' });
            }
        });

        //5 ai generated code from stripe 
        //6. stripe backend e intall kore naw .
        //7. er por stripe k require korte hobe 
        app.post('/create-payment-intent', async (req, res) => {
            // 16 i am here
            const amountInCents = req.body.amountInCents;
            // console.log(amountInCents)
            const paymentIntent = await stripe.paymentIntents.create({
                // 17 ei ta change kore dilam 
                //18 ekhon console log korle arekta data asbhe and go to client payment form 
                amount: amountInCents, // amount in cents
                currency: 'usd',
                payment_method_types: ['card'],
            });

            res.json({ clientSecret: paymentIntent.client_secret });
        });


        // 21 making payment history with ai 
        // API to mark paymentStatus as 'paid' and save payment history
        //api for getting all the data 
        //22 go to client side 
        app.post('/payments', async (req, res) => {
            try {
                const { parcelId, amount, transactionId, email, paymentMethod } = req.body;

                // 1. Update the parcel's paymentStatus to 'paid'
                const parcelUpdateResult = await parcelsCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    { $set: { paymentStatus: 'paid' } }
                );

                // 2. Save payment history
                const paymentEntry = {
                    parcelId: new ObjectId(parcelId),
                    amount,
                    transactionId,
                    email,
                    paymentMethod,
                    paid_at: new Date().toISOString(),
                    paid_At: new Date()
                };
                const paymentResult = await paymentsCollection.insertOne(paymentEntry);

                res.status(200).json({
                    message: 'Payment status updated and payment history saved',
                    parcelUpdateResult,
                    paymentResult
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to update payment status or save payment history' });
            }
        });


        // Get payment history by user (latest first)
        app.get('/payments', async (req, res) => {
            try {
                const email = req.query.email;
                const filter = email ? { email } : {};
                const payments = await paymentsCollection
                    .find(filter)
                    .sort({ paid_At: -1 }) // latest first
                    .toArray();
                res.status(200).json(payments);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch payment history' });
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