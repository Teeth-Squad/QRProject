const connectToDatabase = require('../lib/mongodb');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await connectToDatabase(); // ✅ Use cached connection
    const db = client.db('QRProject');
    const collection = db.collection('QR_Codes');

    const { productName } = req.query;
    const query = productName
      ? { productName: { $regex: productName, $options: 'i' } }
      : {};

    const qrCodes = await collection.find(query).toArray();

    res.status(200).json(qrCodes);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};