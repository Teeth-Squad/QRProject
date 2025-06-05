const { ObjectId } = require('mongodb');
const connectToDatabase = require('../lib/mongodb'); // adjust path as needed

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const client = await connectToDatabase();
    const db = client.db('QRProject');
    const collection = db.collection('Vendors');

    const objectIds = ids.map(id => new ObjectId(id));
    const result = await collection.deleteMany({ _id: { $in: objectIds } });

    return res.status(200).json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};