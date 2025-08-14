const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb').BSON;
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end();
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing Order ID' });

  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return res.status(400).json({ error: 'Invalid Order ID format' });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const collection = client.db('QRProject').collection('Orders');

    const result = await collection.updateOne(
      { _id: objectId },
      { $set: { isActive: false } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({ message: 'Order marked as inactive' });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
};