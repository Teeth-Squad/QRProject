const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { productName, productUrl, qrCodeDataUrl } = req.body;

    if (!productName || !productUrl || !qrCodeDataUrl) {
      return res.status(400).send('Missing fields');
    }

    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('QRProject');
      const collection = db.collection('QR_Codes');

      const document = {
        productName,
        productUrl,
        qrCodeDataUrl,
        createdAt: new Date()
      };

      const result = await collection.insertOne(document);
      console.log(`Inserted QR code with _id: ${result.insertedId}`);

      res.status(200).json({ message: 'QR code saved successfully', id: result.insertedId });

    } catch (err) {
      console.error('Failed to save QR code to database:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    } finally {
      await client.close();
    }
  } catch (err) {
    console.error('General error:', err);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}