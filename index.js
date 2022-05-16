const express = require('express');
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


async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('dental_care').collection('services')
        const bookingCollection = client.db('dental_care').collection('booking')

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        /*   app.get('/available', async (req, res) => {
              const date = req.query.date || 'May 15, 2022'
              // step 1: get all services
              const services = await serviceCollection.find().toArray();
              // step 2: get the booking of that day
              const query = { date: date }
              const booking = await bookingCollection.find(query).toArray();
              // step 3: for each service, find bookings for that service
              services.forEach(service => {
                  const serviceBooking = booking.filter(b => b.treatment === service.name);
                  const booked = serviceBooking.map(s => s.slot);
                  const available = service.slots.filter(s => !booked.includes(s));
                  service.available = available;
                  // set booked in service for see
                  // service.booked = booked;
              })
              res.send(services);
          }) */

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

        app.get('/booking', async (req, res) => {
            const patientEmail = req.query.patientEmail;
            const query = { patientEmail: patientEmail };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
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