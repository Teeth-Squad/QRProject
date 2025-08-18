// Import required modules
const { MongoClient, ObjectId } = require('mongodb');    // MongoDB client & ObjectId helper
const axios = require('axios');                          // For HTTP requests
require('dotenv').config();                              // Load environment variables from .env

// Extract environment variables
const {
    MONGODB_URI,
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    SMTP_USER,
} = process.env;

/**
 * Retrieves an access token from Microsoft Graph API using client credentials.
 */
async function getAccessToken() {
    try {
        console.log("Using tenant:", AZURE_TENANT_ID);

        // Request token from Microsoft OAuth2 endpoint
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

/**
 * Sends an email using Microsoft Graph API.
 * @param {string} toEmail - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} body - HTML email body
 */
async function sendMailGraphAPI(toEmail, subject, body) {
    // Retrieve Microsoft Graph access token
    const accessToken = await getAccessToken();

    // Construct email payload
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

    // Send email request
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

/**
 * Checks if it's time to send an email to a vendor based on their cadence setting.
 * @param {Object} vendor - Vendor document from the database
 * @param {Date} now - Current date
 */
function shouldSendEmail(vendor, now) {
    if (!vendor.lastEmailSent) return true; // No previous email sent

    const lastSent = new Date(vendor.lastEmailSent);
    const diffDays = Math.floor((now - lastSent) / (1000 * 60 * 60 * 24)); // Difference in days

    switch ((vendor.cadence?.type || '').toLowerCase()) {
        case 'daily': return diffDays >= 1;
        case 'weekly': return diffDays >= 7;
        case 'monthly': return diffDays >= 30;
        default: return false;
    }
}

/**
 * Main function - connects to MongoDB, checks vendors, sends emails, and updates records.
 */
async function main() {
    const client = new MongoClient(MONGODB_URI);

    try {
        // Connect to database
        await client.connect();
        const db = client.db('QRProject');
        const vendorsCollection = db.collection('Vendors');
        const ordersCollection = db.collection('Orders');
        const now = new Date();

        // Retrieve all vendors
        const vendors = await vendorsCollection.find({}).toArray();

        for (const vendor of vendors) {
            // Skip if cadence is not met
            if (!shouldSendEmail(vendor, now)) {
                console.log(`⏩ Skipping ${vendor.vendorName}: cadence not met`);
                continue;
            }

            // Retrieve vendor's active orders
            const orders = await ordersCollection.find({
                vendorName: vendor.vendorName,
                isActive: true
            }).toArray();

            if (orders.length === 0) {
                console.log(`📭 Skipping ${vendor.vendorName}: no active orders`);
                continue;
            }

            // Build HTML list of orders
            const orderListHTML = orders
                .map(o => `<li>${o.productName} (Qty: ${o.productOrderQuantity})</li>`)
                .join('');

            // Construct email body
            const emailBody = `
                <p>Hello ${vendor.vendorName},</p>
                <p>Here is a list of items we would like to procure from you:</p>
                <ul>${orderListHTML}</ul>
                <p>Regards,<br>Mitchell Bolton<br>Seattle Biomimetic Dentistry</p>
            `;

            try {
                // Send email
                await sendMailGraphAPI(vendor.vendorEmail, `Orders for ${vendor.vendorName}`, emailBody);
                console.log(`✅ Email sent to ${vendor.vendorEmail}`);

                // Mark orders as inactive
                const orderIds = orders.map(o => o._id);
                await ordersCollection.updateMany(
                    { _id: { $in: orderIds } },
                    { $set: { isActive: false } }
                );

                // Update vendor's last email sent date
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
        // Close database connection
        await client.close();
    }
}

// Run main if this file is executed directly
if (require.main === module) {
    main();
}

// Export main for external use
module.exports = main;

module.exports = async (req, res) => {
  try {
    await main(); // run your existing function

    return res.status(200).json({
      ok: true,
      message: 'Vendor email job completed',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('💥 send_vendor_email failed:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Server error',
      timestamp: new Date().toISOString(),
    });
  }
};