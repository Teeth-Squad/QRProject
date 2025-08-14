const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
require('dotenv').config();

const {
  MONGODB_URI,
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SMTP_USER,
} = process.env;

// Get Microsoft Graph API OAuth2 token
async function getAccessToken() {
  try {
    console.log("Using tenant:", AZURE_TENANT_ID);
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: AZURE_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log("✅ Access token retrieved successfully");
    return tokenResponse.data.access_token;
  } catch (err) {
    console.error("❌ Failed to get access token:", err.response?.data || err.message);
    throw err;
  }
}

// Send email using Microsoft Graph API
async function sendMailGraphAPI(toEmail, subject, body) {
  const accessToken = await getAccessToken();

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: [
        { emailAddress: { address: toEmail } },
      ],
    },
  };

  const response = await axios.post(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SMTP_USER)}/sendMail`,
    message,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`📧 Email send status: ${response.status} ${response.statusText}`);
}

// Check if email should be sent based on cadence & last sent date
function shouldSendEmail(vendor, now) {
  if (!vendor.lastEmailSent) return true;

  const lastSent = new Date(vendor.lastEmailSent);
  const diffDays = Math.floor((now - lastSent) / (1000 * 60 * 60 * 24));

  switch ((vendor.cadence?.type || '').toLowerCase()) {
    case 'daily': return diffDays >= 1;
    case 'weekly': return diffDays >= 7;
    case 'monthly': return diffDays >= 30;
    default: return false;
  }
}

// Main process
async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('QRProject');
    const vendorsCollection = db.collection('Vendors');
    const ordersCollection = db.collection('Orders');
    const now = new Date();

    const vendors = await vendorsCollection.find({}).toArray();

    for (const vendor of vendors) {
      if (!shouldSendEmail(vendor, now)) {
        console.log(`⏩ Skipping ${vendor.vendorName}: cadence not met`);
        continue;
      }

      const orders = await ordersCollection.find({ vendorName: vendor.vendorName, isActive: true }).toArray();
      if (orders.length === 0) {
        console.log(`📭 Skipping ${vendor.vendorName}: no active orders`);
        continue;
      }

      const orderListHTML = orders
        .map(o => `<li>${o.productName} (Qty: ${o.productOrderQuantity})</li>`)
        .join('');

      const emailBody = `
        <p>Hello ${vendor.vendorName},</p>
        <p>Here is a list of items we would like to procure from you:</p>
        <ul>${orderListHTML}</ul>
        <p>Regards,<br>Mitchell Bolton<br>Seattle Biomimetic Dentistry</p>
      `;

      try {
        await sendMailGraphAPI(vendor.vendorEmail, `Orders for ${vendor.vendorName}`, emailBody);
        console.log(`✅ Email sent to ${vendor.vendorEmail}`);

        // Mark all orders just sent as inactive
        const orderIds = orders.map(o => o._id);
        await ordersCollection.updateMany(
          { _id: { $in: orderIds } },
          { $set: { isActive: false } }
        );

        // Update vendor lastEmailSent
        await vendorsCollection.updateOne(
          { _id: vendor._id },
          { $set: { lastEmailSent: now } }
        );

      } catch (e) {
        console.error(`❌ Failed for ${vendor.vendorEmail}:`, e.message);
      }
    }

  } catch (err) {
    console.error('💥 General error:', err);
  } finally {
    await client.close();
  }
}

// Run only if executed directly
if (require.main === module) {
  main();
}

module.exports = main;