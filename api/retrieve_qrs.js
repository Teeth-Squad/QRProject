const { ObjectId } = require('mongodb');
const connectToDatabase = require('../lib/mongodb');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('QRProject');

    const { productName } = req.query;

    // Build search filter
    const matchStage = productName
      ? { productName: { $regex: productName, $options: 'i' } }
      : {};

    // Aggregate QR codes with vendor lookup,
    // but exclude vendorId 'N/A' from lookup (keep vendorName as "N/A")
    const qrCodes = await db.collection('QR_Codes').aggregate([
      { $match: matchStage },
      {
        $addFields: {
          vendorIdObj: {
            $cond: [
              { $or: [
                { $eq: ['$vendorId', 'N/A'] },
                { $not: ['$vendorId'] }
              ] },
              null,
              { $toObjectId: '$vendorId' }
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'Vendors',
          localField: 'vendorIdObj',
          foreignField: '_id',
          as: 'vendorInfo'
        }
      },
      { $unwind: { path: '$vendorInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productName: 1,
          productQuantity: 1,
          productURL: 1,
          qrCodeDataURL: 1,
          vendorId: 1,
          createdAt: 1,
          vendorName: {
            $cond: [
              { $or: [
                { $eq: ['$vendorId', 'N/A'] },
                { $not: ['$vendorId'] }
              ] },
              'N/A',
              '$vendorInfo.vendorName'
            ]
          }
        }
      }
    ]).toArray();

    res.status(200).json(qrCodes);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};