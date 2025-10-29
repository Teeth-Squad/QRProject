// api/send_vendor_email.js  (CommonJS for Vercel Pages functions)

const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

// ===== Env (set in Vercel dashboard; do NOT use dotenv on Vercel) =====
const {
  MONGODB_URI,
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SMTP_USER,
  CRON_SECRET,
} = process.env;

// ===== Mongo client reuse across invocations =====
let mongoClient;
async function getDb() {
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI);
  // Topology check works for both v4 & v5 drivers
  if (!mongoClient.topology || mongoClient.topology.isDestroyed?.() || !mongoClient.topology.isConnected?.()) {
    await mongoClient.connect();
  }
  return mongoClient.db('QRProject');
}

// ===== Timezone helpers (midnight local window) =====
const DEFAULT_TZ = 'America/Los_Angeles';

function toZonedDate(date, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = parseInt(p.value, 10);
    return acc;
  }, {});
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}
function startOfDayZoned(date, tz = DEFAULT_TZ) {
  const d = toZonedDate(date, tz);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfLocalDay(date, tz = DEFAULT_TZ) {
  return startOfDayZoned(date, tz); // already midnight local (as UTC)
}
function startOfWeekdayWindow(date, tz, dayOfWeek /*0=Sun..6=Sat*/) {
  const z = toZonedDate(date, tz);
  const todayStart = startOfLocalDay(z, tz);
  const curDow = todayStart.getUTCDay();
  const sunday = new Date(todayStart);
  sunday.setUTCDate(sunday.getUTCDate() - curDow);
  const win = new Date(sunday);
  win.setUTCDate(win.getUTCDate() + dayOfWeek);
  // it's already 00:00 local because we anchored to local-midnight
  return win;
}
function startOfMonthDayWindow(date, tz, dom /*1..31*/) {
  const z = toZonedDate(date, tz);
  const y = z.getUTCFullYear();
  const m = z.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(dom || 1, 1), last);
  return new Date(Date.UTC(y, m, d, 0, 0, 0));
}

// ===== Cadence parsing =====
function parseCadence(cadence) {
  const base = typeof cadence === 'object' && cadence ? cadence : {};
  const out = {
    type: (base.type || (typeof cadence === 'string' ? cadence.split(' ')[0] : '') || '').toLowerCase(),
    timeZone: base.timeZone || DEFAULT_TZ,
    // hour/minute intentionally ignored by window logic; left for compatibility
    hour: base.hour ?? 9,
    minute: base.minute ?? 0,
  };

  if (typeof cadence === 'string') {
    const s = cadence.trim().toLowerCase();
    if (s.startsWith('weekly on')) {
      out.type = 'weekly';
      const dayStr = s.replace('weekly on', '').trim();
      const map = { sun:0, mon:1, tue:2, tues:2, wed:3, thu:4, thur:4, fri:5, sat:6 };
      out.dayOfWeek = map[dayStr.slice(0,3)] ?? 2;
    } else if (s === 'daily') {
      out.type = 'daily';
    } else if (s.startsWith('monthly on')) {
      out.type = 'monthly';
      const n = parseInt(s.replace('monthly on','').trim(), 10);
      if (!Number.isNaN(n)) out.dayOfMonth = Math.min(Math.max(n,1),31);
    }
    return out;
  }
  if (out.type === 'weekly' && typeof base.dayOfWeek === 'number') out.dayOfWeek = Math.max(0, Math.min(6, base.dayOfWeek));
  if (out.type === 'monthly' && typeof base.dayOfMonth === 'number') out.dayOfMonth = Math.max(1, Math.min(31, base.dayOfMonth));
  if (out.type === 'every-x-weeks' && typeof base.interval === 'number') out.interval = Math.max(1, Math.floor(base.interval));
  if (Array.isArray(base.daysOfWeek)) out.daysOfWeek = base.daysOfWeek;
  return out;
}

// ===== Midnight-window evaluator =====
function evaluateCadenceDue(vendor, now) {
  const cadence = parseCadence(vendor.cadence || vendor.cadenceText || vendor.cadenceString);
  const tz = cadence.timeZone || DEFAULT_TZ;

  const zonedNow = toZonedDate(now, tz);
  const todayStart = startOfLocalDay(now, tz);
  const dowNow = todayStart.getUTCDay();

  const lastWindow = vendor.lastEmailWindowStart ? new Date(vendor.lastEmailWindowStart) : null;
  const alreadySentFor = (ws) => lastWindow && ws && lastWindow.getTime() === ws.getTime();

  // DAILY → eligible any time after today's local midnight
  if (cadence.type === 'daily') {
    const windowStart = todayStart;
    return { shouldSend: zonedNow >= windowStart && !alreadySentFor(windowStart), windowStart };
  }

  // WEEKLY (single day) → only on the target weekday, from local midnight
  if (cadence.type === 'weekly') {
    const target = typeof cadence.dayOfWeek === 'number' ? cadence.dayOfWeek : 2; // default Tue
    const windowStart = startOfWeekdayWindow(now, tz, target);
    if (dowNow !== target) return { shouldSend: false, windowStart };
    return { shouldSend: zonedNow >= windowStart && !alreadySentFor(windowStart), windowStart };
  }

  // WEEKLY MULTI → any selected weekday, from local midnight
  if (cadence.type === 'weekly-multi' || cadence.type?.includes?.('select')) {
    const days = Array.isArray(cadence.daysOfWeek)
      ? cadence.daysOfWeek
      : Array.isArray(vendor.daysOfWeek)
      ? vendor.daysOfWeek
      : [];
    const windowStart = todayStart;
    const isSelected = days.includes(dowNow);
    return { shouldSend: isSelected && zonedNow >= windowStart && !alreadySentFor(windowStart), windowStart };
  }

  // EVERY X WEEKS (on a weekday) → only on target weekday; ensure >= interval weeks between windows
  if (cadence.type === 'every-x-weeks') {
    const interval = Number.isFinite(cadence.interval) ? Math.max(1, cadence.interval) : 2;
    const target = typeof cadence.dayOfWeek === 'number' ? cadence.dayOfWeek : 2;
    const windowStart = startOfWeekdayWindow(now, tz, target);
    if (dowNow !== target) return { shouldSend: false, windowStart };
    if (alreadySentFor(windowStart)) return { shouldSend: false, windowStart };
    if (!lastWindow) return { shouldSend: zonedNow >= windowStart, windowStart };
    const weeksBetween = Math.floor((windowStart - lastWindow) / (7 * 24 * 60 * 60 * 1000));
    return { shouldSend: weeksBetween >= interval && zonedNow >= windowStart, windowStart };
  }

  // MONTHLY (on day-of-month) → only on that calendar day, from local midnight
  if (cadence.type === 'monthly') {
    const dom = cadence.dayOfMonth ?? 1;
    const windowStart = startOfMonthDayWindow(now, tz, dom);
    const isTodayDom =
      todayStart.getUTCDate() === windowStart.getUTCDate() &&
      todayStart.getUTCMonth() === windowStart.getUTCMonth() &&
      todayStart.getUTCFullYear() === windowStart.getUTCFullYear();
    if (!isTodayDom) return { shouldSend: false, windowStart };
    return { shouldSend: zonedNow >= windowStart && !alreadySentFor(windowStart), windowStart };
  }

  return { shouldSend: false, windowStart: null };
}

// ===== Microsoft Graph (token cache + retry) =====
let cachedToken = null;
let cachedExp = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExp - 60_000) return cachedToken;
  const resp = await axios.post(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: AZURE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );
  cachedToken = resp.data.access_token;
  cachedExp = now + (resp.data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function graphPostWithRetry(url, payload, headers, maxRetries = 5) {
  let attempt = 0, wait = 500;
  for (;;) {
    try {
      return await axios.post(url, payload, { headers, timeout: 15000 });
    } catch (e) {
      const s = e.response?.status;
      const retryable = s === 429 || (s >= 500 && s < 600);
      if (!retryable || attempt >= maxRetries) throw e;
      const retryAfter = parseInt(e.response?.headers?.['retry-after'] || '0', 10);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : wait;
      await new Promise(r => setTimeout(r, delay));
      wait = Math.min(wait * 2, 8000);
      attempt++;
    }
  }
}

async function sendMailGraphAPI(toEmail, subject, bodyHtml) {
  const token = await getAccessToken();
  const message = {
    message: {
      subject,
      body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    },
    saveToSentItems: true,
  };
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SMTP_USER)}/sendMail`;
  const res = await graphPostWithRetry(url, message, {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });
  return res.status; // 202 expected
}

// ===== Job runner (with simple Mongo lock to avoid overlaps) =====
async function runJob() {
  const db = await getDb();
  const vendors = db.collection('Vendors');
  const orders = db.collection('Orders');
  const jobs = db.collection('Jobs'); // for lock

  // Ensure TTL index for lock auto-expire (idempotent)
  await jobs.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  // Acquire lock via strict insert
  const lockId = 'send_vendor_email_lock';
  const expireAt = new Date(Date.now() + 15 * 60 * 1000);
  try {
    await jobs.insertOne({ _id: lockId, expireAt });
  } catch (e) {
    // Another run in progress
    console.log('🔒 Another run is in progress. Exiting.');
    return;
  }

  const now = new Date();
  try {
    const cursor = vendors.find({});
    while (await cursor.hasNext()) {
      const vendor = await cursor.next();
      const vName = vendor.vendorName || `(vendor:${vendor._id})`;

      const { shouldSend, windowStart } = evaluateCadenceDue(vendor, now);
      if (!shouldSend) {
        console.log(`⏩ Skip ${vName} — cadence not due`);
        continue;
      }

      const items = await orders.find({ vendorName: vendor.vendorName, isActive: true }).toArray();
      if (!items.length) {
        console.log(`📭 Skip ${vName} — no active orders`);
        continue;
      }

      const listHtml = items
        .map(o => `<li>${o.productName} (Qty: ${o.productOrderQuantity ?? 1})</li>`)
        .join('');
      const emailBody = `
        <p>Hello ${vendor.vendorName},</p>
        <p>Here is a list of items we would like to procure from you:</p>
        <ul>${listHtml}</ul>
        <p>Regards,<br>Mitchell Bolton<br>Seattle Biomimetic Dentistry</p>
      `;

      try {
        const status = await sendMailGraphAPI(
          vendor.vendorEmail,
          `Orders for ${vendor.vendorName}`,
          emailBody
        );
        console.log(`✅ Sent to ${vendor.vendorEmail} — HTTP ${status}`);

        // Mark sent + close orders
        const ids = items.map(o => (o._id instanceof ObjectId ? o._id : new ObjectId(o._id)));
        await orders.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
        await vendors.updateOne(
          { _id: vendor._id },
          { $set: { lastEmailSent: now, lastEmailWindowStart: windowStart ?? null } }
        );
      } catch (e) {
        const status = e.response?.status;
        const reqId = e.response?.headers?.['request-id'] || e.response?.headers?.['x-ms-ags-diagnostic'];
        console.error(`❌ Failed for ${vendor.vendorEmail} — status:${status} reqId:${reqId} msg:${e.message}`);
        if (e.response?.data) console.error('   Graph:', JSON.stringify(e.response.data));
        // Do not mutate DB on failure
      }
    }
  } finally {
    // Release lock by expiring now
    await jobs.updateOne({ _id: lockId }, { $set: { expireAt: new Date() } }).catch(() => {});
  }
}

// ===== Vercel default export (accepts GET/POST) with shared-secret auth =====
module.exports = async function handler(req, res) {
  try {
    const token = req.headers['x-cron-secret'] || req.query?.token;
    if (!CRON_SECRET || token !== CRON_SECRET) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    await runJob();
    return res.status(200).json({ ok: true, message: 'Vendor email job completed', at: new Date().toISOString() });
  } catch (err) {
    console.error('💥 send_vendor_email failed:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error', at: new Date().toISOString() });
  }
};