const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb').BSON;
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end();
  }

  const client = new MongoClient(uri);
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: 'Missing Oder ID' });

  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return res.status(400).json({ error: 'Invalid Oder ID format' });
  }

  try {
    await client.connect();
    const collection = client.db('QRProject').collection('Orders');
    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Oder not found' });
    }

    res.status(200).json({ message: 'Oder deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await client.close();
  }
};