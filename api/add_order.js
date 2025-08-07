const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

module.exports = async (req, res) => {
  // Ensure it's a POST request
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Extract data from the request body
    const { productName, productQuantity, productUrl, productOrderQuantity } = req.body;

    // Validate that the required fields are provided
    if (!productName || !productQuantity || !productUrl || !productOrderQuantity) {
      return res.status(400).send('Missing fields');
    }

    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('QRProject');
      const collection = db.collection('Orders');

      const document = {
        productName,
        productUrl,
        productQuantity,
        productOrderQuantity,
        createdAt: new Date(),
        isAvtive: true
      };

      const result = await collection.insertOne(document);
      console.log(`Inserted order with _id: ${result.insertedId}`);

      // Send a success response
      res.status(200).json({ message: 'Order saved successfully', id: result.insertedId });

    } catch (err) {
      console.error('Failed to save order to database:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    } finally {
      await client.close();
    }
  } catch (err) {
    console.error('General error:', err);
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
};