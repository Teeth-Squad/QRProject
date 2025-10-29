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

// ==== Scheduling / timezone helpers ====

const DEFAULT_TZ = 'America/Los_Angeles';

function toZonedDate(date, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  })
    .formatToParts(date)
    .reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = parseInt(p.value, 10);
      return acc;
    }, {});
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

function startOfDayZoned(date, timeZone = DEFAULT_TZ) {
  const d = toZonedDate(date, timeZone);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseCadence(cadence) {
  const base = typeof cadence === 'object' && cadence !== null ? cadence : {};
  const out = {
    type: (base.type || (typeof cadence === 'string' ? cadence.split(' ')[0] : '') || '').toLowerCase(),
    timeZone: base.timeZone || DEFAULT_TZ,
    hour: base.hour ?? 9,
    minute: base.minute ?? 0,
  };

  if (typeof cadence === 'string') {
    const s = cadence.trim().toLowerCase();
    if (s.startsWith('weekly on')) {
      out.type = 'weekly';
      const dayStr = s.replace('weekly on', '').trim();
      const map = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, fri: 5, sat: 6 };
      out.dayOfWeek = map[dayStr.slice(0, 3)] ?? 2;
    } else if (s === 'daily') {
      out.type = 'daily';
    } else if (s.startsWith('monthly on')) {
      out.type = 'monthly';
      const num = parseInt(s.replace('monthly on', '').trim(), 10);
      if (!Number.isNaN(num)) out.dayOfMonth = Math.min(Math.max(num, 1), 31);
    }
    return out;
  }

  if (out.type === 'weekly' && typeof base.dayOfWeek === 'number') {
    out.dayOfWeek = Math.max(0, Math.min(6, base.dayOfWeek));
  }
  if (out.type === 'monthly' && typeof base.dayOfMonth === 'number') {
    out.dayOfMonth = Math.max(1, Math.min(31, base.dayOfMonth));
  }
  return out;
}

function scheduledThisWeek(now, tz, dayOfWeek, hour = 9, minute = 0) {
  const zonedNow = toZonedDate(now, tz);
  const anchor = startOfDayZoned(zonedNow, tz);
  const dow = anchor.getUTCDay();
  const sunday = new Date(anchor);
  sunday.setUTCDate(sunday.getUTCDate() - dow);

  const sched = new Date(sunday);
  sched.setUTCDate(sched.getUTCDate() + dayOfWeek);
  sched.setUTCHours(hour, minute, 0, 0);
  return sched;
}

function nextWeeklyOnOrAfter(date, tz, dayOfWeek, hour = 9, minute = 0) {
  const schedThis = scheduledThisWeek(date, tz, dayOfWeek, hour, minute);
  const zDate = toZonedDate(date, tz);
  if (zDate <= schedThis) return schedThis;
  const next = new Date(schedThis);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

function scheduledThisMonth(now, tz, dayOfMonth = 1, hour = 9, minute = 0) {
  const z = toZonedDate(now, tz);
  const y = z.getUTCFullYear();
  const m = z.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dom = Math.min(dayOfMonth, lastDay);
  return new Date(Date.UTC(y, m, dom, hour, minute, 0));
}

function nextMonthlyOnOrAfter(date, tz, dayOfMonth = 1, hour = 9, minute = 0) {
  const tryThis = scheduledThisMonth(date, tz, dayOfMonth, hour, minute);
  const zDate = toZonedDate(date, tz);
  if (zDate <= tryThis) return tryThis;
  const y = tryThis.getUTCFullYear();
  const m = tryThis.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dom = Math.min(dayOfMonth, lastDay);
  return new Date(Date.UTC(y, m, dom, hour, minute, 0));
}

// 🧩 UPDATED: Evaluate cadence with support for Weekly-Multi & Every-X-Weeks
function evaluateCadenceDue(vendor, now) {
  const cadenceRaw = vendor.cadence || vendor.cadenceText || vendor.cadenceString;
  const cadence = parseCadence(cadenceRaw);
  const tz = cadence.timeZone || DEFAULT_TZ;
  const lastSent = vendor.lastEmailSent ? new Date(vendor.lastEmailSent) : null;
  const zonedNow = toZonedDate(now, tz);
  const dayOfWeekNow = zonedNow.getUTCDay();
  const diffDays = lastSent ? Math.floor((zonedNow - toZonedDate(lastSent, tz)) / (1000 * 60 * 60 * 24)) : Infinity;
  const diffWeeks = Math.floor(diffDays / 7);

  // DAILY
  if (cadence.type === 'daily') {
    const todayStart = startOfDayZoned(now, tz);
    const windowStart = new Date(todayStart);
    windowStart.setUTCHours(cadence.hour, cadence.minute, 0, 0);
    const alreadySentToday = lastSent && startOfDayZoned(lastSent, tz).getTime() === startOfDayZoned(now, tz).getTime();
    return { shouldSend: !alreadySentToday && zonedNow >= windowStart, windowStart };
  }

  // WEEKLY (single day)
  if (cadence.type === 'weekly') {
    const dow = typeof cadence.dayOfWeek === 'number' ? cadence.dayOfWeek : 2;
    const due = nextWeeklyOnOrAfter(now, tz, dow, cadence.hour, cadence.minute);
    const alreadySentThisWeek = lastSent && nextWeeklyOnOrAfter(lastSent, tz, dow, cadence.hour, cadence.minute) >= due;
    return { shouldSend: !alreadySentThisWeek && zonedNow >= due, windowStart: due };
  }

  // WEEKLY (select multiple days)
  if (cadence.type === 'weekly-multi' || cadence.type.includes('select')) {
    const days = cadence.daysOfWeek || vendor.daysOfWeek || [];
    const isTodaySelected = days.includes(dayOfWeekNow);
    const alreadySentToday = lastSent && startOfDayZoned(lastSent, tz).getTime() === startOfDayZoned(now, tz).getTime();
    return { shouldSend: isTodaySelected && !alreadySentToday, windowStart: startOfDayZoned(now, tz) };
  }

  // EVERY X WEEKS ON A DAY
  if (cadence.type === 'every-x-weeks') {
    const interval = cadence.interval || 2;
    const targetDay = cadence.dayOfWeek ?? 2;
    const correctWeek = diffWeeks % interval === 0;
    const alreadySentThisWeek = lastSent && startOfDayZoned(lastSent, tz).getTime() === startOfDayZoned(now, tz).getTime();
    return { shouldSend: correctWeek && dayOfWeekNow === targetDay && !alreadySentThisWeek, windowStart: startOfDayZoned(now, tz) };
  }

  // MONTHLY
  if (cadence.type === 'monthly') {
    const dom = cadence.dayOfMonth ?? 1;
    const due = nextMonthlyOnOrAfter(now, tz, dom, cadence.hour, cadence.minute);
    const lastWindow = lastSent ? nextMonthlyOnOrAfter(lastSent, tz, dom, cadence.hour, cadence.minute) : null;
    const alreadySentThisWindow = lastSent && lastWindow && new Date(lastSent) >= lastWindow;
    return { shouldSend: !alreadySentThisWindow && zonedNow >= due, windowStart: due };
  }

  return { shouldSend: false, windowStart: null };
}

// ==== Microsoft Graph mail ====

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

async function sendMailGraphAPI(toEmail, subject, body) {
  const accessToken = await getAccessToken();
  const message = {
    message: {
      subject,
      body: { contentType: 'HTML', content: body },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    },
  };
  const response = await axios.post(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SMTP_USER)}/sendMail`,
    message,
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    }
  );
  console.log(`📧 Email send status: ${response.status} ${response.statusText}`);
}

// ==== Main worker ====

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
      const { shouldSend, windowStart } = evaluateCadenceDue(vendor, now);

      if (!shouldSend) {
        console.log(`⏩ Skipping ${vendor.vendorName || vendor._id}: cadence not due`);
        continue;
      }

      const orders = await ordersCollection.find({
        vendorName: vendor.vendorName,
        isActive: true,
      }).toArray();

      if (orders.length === 0) {
        console.log(`📭 Skipping ${vendor.vendorName}: no active orders`);
        continue;
      }

      const orderListHTML = orders.map(o => `<li>${o.productName} (Qty: ${o.productOrderQuantity})</li>`).join('');
      const emailBody = `
        <p>Hello ${vendor.vendorName},</p>
        <p>Here is a list of items we would like to procure from you:</p>
        <ul>${orderListHTML}</ul>
        <p>Regards,<br>Mitchell Bolton<br>Seattle Biomimetic Dentistry</p>
      `;

      try {
        await sendMailGraphAPI(vendor.vendorEmail, `Orders for ${vendor.vendorName}`, emailBody);
        console.log(`✅ Email sent to ${vendor.vendorEmail}`);

        const orderIds = orders.map(o => o._id);
        await ordersCollection.updateMany({ _id: { $in: orderIds } }, { $set: { isActive: false } });

        await vendorsCollection.updateOne(
          { _id: vendor._id },
          { $set: { lastEmailSent: now, lastEmailWindowStart: windowStart || null } }
        );
      } catch (e) {
        console.error(`❌ Failed for ${vendor.vendorEmail}:`, e.response?.data || e.message);
      }
    }
  } catch (err) {
    console.error('💥 General error:', err);
    throw err;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(() => process.exit(1));
}

module.exports = {
  main,
  handler: async (req, res) => {
    try {
      await main();
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
  },
};