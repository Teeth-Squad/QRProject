const connectToDatabase = require('../lib/mongodb');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('QRProject');
    const collection = db.collection('Orders');

    const { productName } = req.query;

    // Always filter for active orders
    const query = {
      isAvtive: true,
      ...(productName && {
        productName: { $regex: productName, $options: 'i' }
      })
    };

    const orderResults = await collection.find(query).toArray();

    res.status(200).json(orderResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};