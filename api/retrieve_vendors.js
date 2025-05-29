const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();
const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('QRProject');
    const vendors = await db.collection('Vendors').find().toArray();

    res.status(200).json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve vendors' });
  } finally {
    await client.close();
  }
};