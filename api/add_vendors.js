const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();
const uri = process.env.MONGODB_URI;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { vendorName, vendorEmail, cadence } = req.body;

    if (!vendorName || !vendorEmail || !cadence || !cadence.type) {
      return res.status(400).send('Missing vendorName, vendorEmail, or cadence.type');
    }

    // Validate cadence object structure
    switch (cadence.type) {
      case 'daily':
        // No extra data needed
        break;
      case 'weekly':
        if (!Array.isArray(cadence.days) || cadence.days.length === 0) {
          return res.status(400).send('Weekly cadence must include at least one valid day');
        }
        break;
      case 'every_x_weeks':
        if (!cadence.interval || cadence.interval < 1 || !cadence.day) {
          return res.status(400).send('Every X Weeks cadence must include interval and day');
        }
        break;
      case 'monthly':
        if (!cadence.day || cadence.day < 1 || cadence.day > 31) {
          return res.status(400).send('Monthly cadence must include a valid day (1-31)');
        }
        break;
      default:
        return res.status(400).send('Invalid cadence type');
    }

    const client = new MongoClient(uri);

    try {
      await client.connect();
      const db = client.db('QRProject');
      const collection = db.collection('Vendors');

      const document = {
        vendorName,
        vendorEmail,
        cadence,
        lastEmailSent: null,
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