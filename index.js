const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middle ware
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ev0b9.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        else {
            req.decoded = decoded;
            next();
        }
    })
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('dental_care').collection('services');
        const bookingCollection = client.db('dental_care').collection('booking');
        const userCollection = client.db('dental_care').collection('users');

        app.get('/users', verifyJWT, async(req, res)=>{
            const users = await userCollection.find().toArray();
            res.send(users)
        });

        app.get('/admin/:email', async(req, res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
                const filter = { email: email };
            const updateDoc = {
                $set: {role: 'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc,);
            res.send(result);
            }
            else{
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            
        });


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, accessToken });
        });

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })



        //   Warning
        //   This is not the proper way to query
        //  after learning more about mongodb, use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // step 1: get all services
            const services = await serviceCollection.find().toArray();

            // step 2: get booking of that day. output : [{}, {}, {}, {}, {}, {}, {}]
            const query = { date: date }
            const booking = await bookingCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4:  find booking for that service. output : [{}, {}, {}]
                const serviceBooking = booking.filter(book => book.treatment === service.name);

                // step 5: select slots for the service booking: Output: ['', '', '', '', '']
                const bookedSlots = serviceBooking.map(book => book.slot);

                // step 6: select those slots that are not in bookslots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));

                // step 7: set available to slots to make it easier
                service.slots = available;
            })
            res.send(services)
        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patientEmail = req.query.patientEmail;
            const decodedEmail = req.decoded.email;
            if (patientEmail === decodedEmail) {
                const query = { patientEmail: patientEmail };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });
        })

    }
    finally {

    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Welcome to the dental care');
})

app.listen(port, () => {
    console.log('Listening Port is', port);
})