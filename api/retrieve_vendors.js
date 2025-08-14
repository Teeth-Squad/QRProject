// Import required modules
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();
const uri = process.env.MONGODB_URI;

/**
 * API handler to retrieve all vendors from the database
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 */
module.exports = async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    const client = new MongoClient(uri);

    try {
        // Connect to MongoDB
        await client.connect();
        const db = client.db('QRProject');

        // Retrieve all documents from the Vendors collection
        const vendors = await db.collection('Vendors').find().toArray();

        // Return vendors as JSON
        res.status(200).json(vendors);
    } catch (err) {
        // Handle errors
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve vendors' });
    } finally {
        // Ensure the MongoDB connection is closed
        await client.close();
    }
};