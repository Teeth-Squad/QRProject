const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { vendorName, vendorEmail } = req.body;

    if (!vendorName || !vendorEmail) {
      return res.status(400).send('Missing vendorName or vendorEmail');
    }

    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('QRProject');
      const collection = db.collection('Vendors');

      const document = {
        vendorName,
        vendorEmail,
        createdAt: new Date()
      };

      const result = await collection.insertOne(document);
      console.log(`Inserted vendor with _id: ${result.insertedId}`);

      res.status(200).json({ message: 'Vendor added successfully', id: result.insertedId });

    } catch (err) {
      console.error('Failed to save vendor to database:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    } finally {
      await client.close();
    }
  } catch (err) {
    console.error('General error:', err);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
};