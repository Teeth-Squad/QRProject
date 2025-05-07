const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('QRProject');
    const collection = db.collection('Orders');

    const { productName } = req.query;
    const query = productName ? { productName: { $regex: productName, $options: 'i' } } : {};

    const orderResults = await collection.find(query).toArray();

    if (!orderResults.length) {
      return res.status(404).json({ message: 'No Orders found' });
    }

    res.status(200).json(orderResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    await client.close();
  }
};