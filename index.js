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

const admin = require("firebase-admin");

//9 path ser kore dhibho 
//10 verify the toke 
const serviceAccount = require("./firebase_key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});




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
        // tracking collection 
        const trackingCollection = client.db("zapShift").collection("track");
        const userCollection = client.db("zapShift").collection("users");
        const ridersCollection = client.db("zapShift").collection("riders");

        // custom middleware 
        async function verifyToken(req, res, next) {
            const authHeader = req.headers.authorization;
            console.log('heade in middle ware ', authHeader)
            //5 use this as middleware in
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }

            // 6.now verify the token go to firebase // service center
            // 7.install firebase admin 
            //10
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                req.decoded = decodedToken;
                next();
            } catch (error) {
                return res.status(403).send({ message: 'Forbidden access', error: error.message });
            }
        }

        // verify  admin 
        // eta obossoi token er niche use korte  hobe  
        const verifyAdmin =async (req,res,next) =>{
            const email = req.decoded.email;
            const query = {email};
            const user = await userCollection.findOne(query);

            if(!user || user.role !== 'admin'){
               return res.status(403).send({message : 'forbidden access'})
            }
            next();
        }

        // Backend: Get users by partial email
        app.get('/admin/search', async (req, res) => {
            try {
                const { email } = req.query;
                if (!email) return res.status(400).json({ message: 'Email query is required' });

                const result = await userCollection
                    .find({ email: { $regex: email, $options: 'i' } }) // case-insensitive partial match
                    .limit(10) // Optional: limit result for performance
                    .toArray();

                res.send(result);
            } catch (error) {
                console.error('Search error:', error);
                res.status(500).json({ message: 'Server error' });
            }
        });

        // ✅ API to make a user an admin
        app.patch('/make-admin',verifyToken,verifyAdmin, async (req, res) => {
            const { email, role } = req.body;

            if (!email || !role) {
                return res.status(400).json({ message: 'Email and role are required' });
            }

            try {
                const result = await userCollection.updateOne(
                    { email },
                    { $set: { role } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.json({ message: `User role updated to ${role}` });
            } catch (error) {
                console.error('Error updating user role:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });



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
        app.get('/parcels', verifyToken, async (req, res) => {

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
        //8. er por web site theke generate private key tar ota file theke ekhane niye asbho 
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
        app.get('/payments', verifyToken, async (req, res) => {
            //check it out 3 jwt
            // console.log(req.headers.authorization)
            //4 crate a custom middle ware 
            try {
                const email = req.query.email;
                // console.log(req.decoded)
                if (req.decoded.email !== email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }
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


        // tracking id post 
        app.post('/track', async (req, res) => {
            try {
                const { parcelId, status, message, updated_by = "", tracking_id } = req.body;

                const log = {
                    parcelId,
                    status,
                    message,
                    updated_by,
                    tracking_id,
                    updatedAt: new Date()
                };

                const result = await trackingCollection.insertOne(log);
                res.send(result)


            } catch (error) {
                res.status(500).json({ error: 'Failed to update parcel status' });
            }
        });



        // ---------------- user ---------------
        app.post('/users', async (req, res) => {
            try {
                const { email } = req.body;
                if (!email) {
                    return res.status(400).json({ message: 'Email is required' });
                }
                const existingUser = await userCollection.findOne({ email });
                if (existingUser) {
                    return res.status(200).json({ message: 'User already exists' });
                }
                const user = req.body;
                const result = await userCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to check user' });
            }
        });


        // get user with emai 
        // ✅ API to get full user info by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;

            if (!email) {
                return res.status(400).json({ message: 'Email is required' });
            }

            try {
                // Find full user document by email
                const user = await userCollection.findOne({ email });

                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                res.send(user);
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });



        // ---------------------Rider---------------
        //  post data for rider 
        app.post('/riders', async (req, res) => {
            const rider = req.body;
            // console.log(parcel)
            const result = await ridersCollection.insertOne(rider);
            res.send(result)
        });

        // get rider who are pending  
        // / Get all riders whose status is 'pending'
        app.get('/pendingRiders', async (req, res) => {
            try {
                // Optional: check admin role (if role-based access is implemented)
                // if (req.decoded.role !== 'admin') {
                //     return res.status(403).send({ message: 'Forbidden access' });
                // }

                const pendingRiders = await ridersCollection
                    .find({ status: 'pending' })
                    .sort({ appliedAt: -1 }) // latest applied first
                    .toArray();

                res.status(200).json(pendingRiders);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch pending riders' });
            }
        });

        // patch request for updating rider 
        app.patch('/riders/:id', async (req, res) => {
            const id = req.params.id;
            const { status, email } = req.body;
            // console.log(req.body)
            try {
                const result = await ridersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'approved' } }
                );

                if (status === 'approved') {
                    const queryEmail = { email };
                    const userUpdatedDoc = {
                        $set: {
                            role: 'rider',
                        }
                    }
                    const resultUser = await userCollection.updateOne(queryEmail, userUpdatedDoc)
                    console.log(resultUser.modifiedCount)
                }

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Rider not found' });
                }
                res.json({ message: 'Rider approved successfully' });
            } catch (error) {
                console.error('Error approving rider:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });

        // ✅ API to get all approved riders
        app.get('/riders/active', async (req, res) => {
            try {
                // Find all riders with status 'approved'
                const approvedRiders = await ridersCollection.find({ status: 'approved' }).toArray();

                // Send the result to the client
                res.send(approvedRiders);
            } catch (error) {
                // Log and send error response if something goes wrong
                console.error('Failed to fetch approved riders:', error);
                res.status(500).send({ error: 'Internal server error' });
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