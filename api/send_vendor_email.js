import { MongoClient, ObjectId } from "mongodb";
import axios from "axios";

// --- Env (set these in Vercel Project Settings → Environment Variables)
const {
  MONGODB_URI,
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  SMTP_USER,
} = process.env;

// Reuse Mongo client across invocations
let mongoClient;
async function getDb() {
  if (!mongoClient) mongoClient = new MongoClient(MONGODB_URI);
  if (!mongoClient.topology || !mongoClient.topology.isConnected?.()) {
    await mongoClient.connect();
  }
  return mongoClient.db("QRProject");
}

// ==== Scheduling / timezone helpers ====
const DEFAULT_TZ = "America/Los_Angeles";

function toZonedDate(date, timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = parseInt(p.value, 10);
    return acc;
  }, {});
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}
function startOfDayZoned(date, tz = DEFAULT_TZ) {
  const d = toZonedDate(date, tz);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function parseCadence(cadence) {
  const base = typeof cadence === "object" && cadence ? cadence : {};
  const out = {
    type: (base.type || (typeof cadence === "string" ? cadence.split(" ")[0] : "") || "").toLowerCase(),
    timeZone: base.timeZone || DEFAULT_TZ,
    hour: base.hour ?? 9,
    minute: base.minute ?? 0,
  };
  if (typeof cadence === "string") {
    const s = cadence.trim().toLowerCase();
    if (s.startsWith("weekly on")) {
      out.type = "weekly";
      const map = { sun:0, mon:1, tue:2, tues:2, wed:3, thu:4, thur:4, fri:5, sat:6 };
      out.dayOfWeek = map[s.replace("weekly on","").trim().slice(0,3)] ?? 2;
    } else if (s === "daily") out.type = "daily";
    else if (s.startsWith("monthly on")) {
      out.type = "monthly";
      const n = parseInt(s.replace("monthly on","").trim(), 10);
      if (!Number.isNaN(n)) out.dayOfMonth = Math.min(Math.max(n,1),31);
    }
  } else {
    if (out.type === "weekly" && typeof base.dayOfWeek === "number") out.dayOfWeek = Math.max(0, Math.min(6, base.dayOfWeek));
    if (out.type === "monthly" && typeof base.dayOfMonth === "number") out.dayOfMonth = Math.max(1, Math.min(31, base.dayOfMonth));
  }
  return out;
}
function scheduledThisWeek(now, tz, dow, hour=9, minute=0) {
  const z = toZonedDate(now, tz);
  const anchor = startOfDayZoned(z, tz);
  const curDow = anchor.getUTCDay();
  const sunday = new Date(anchor); sunday.setUTCDate(sunday.getUTCDate() - curDow);
  const t = new Date(sunday); t.setUTCDate(t.getUTCDate() + dow); t.setUTCHours(hour, minute, 0, 0);
  return t;
}
function nextWeeklyOnOrAfter(date, tz, dow, hour=9, minute=0) {
  const t = scheduledThisWeek(date, tz, dow, hour, minute);
  const z = toZonedDate(date, tz);
  if (z <= t) return t;
  const n = new Date(t); n.setUTCDate(n.getUTCDate() + 7); return n;
}
function scheduledThisMonth(now, tz, dom=1, hour=9, minute=0) {
  const z = toZonedDate(now, tz); const y = z.getUTCFullYear(); const m = z.getUTCMonth();
  const last = new Date(Date.UTC(y, m+1, 0)).getUTCDate();
  const d = Math.min(dom, last);
  return new Date(Date.UTC(y, m, d, hour, minute, 0));
}
function nextMonthlyOnOrAfter(date, tz, dom=1, hour=9, minute=0) {
  const t = scheduledThisMonth(date, tz, dom, hour, minute);
  const z = toZonedDate(date, tz);
  if (z <= t) return t;
  const y = t.getUTCFullYear(); const m = t.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m+1, 0)).getUTCDate();
  const d = Math.min(dom, last);
  return new Date(Date.UTC(y, m, d, hour, minute, 0));
}
function evaluateCadenceDue(vendor, now) {
  const cadence = parseCadence(vendor.cadence || vendor.cadenceText || vendor.cadenceString);
  const tz = cadence.timeZone || DEFAULT_TZ;
  const lastSent = vendor.lastEmailSent ? new Date(vendor.lastEmailSent) : null;
  const zonedNow = toZonedDate(now, tz);
  const dowNow = zonedNow.getUTCDay();

  if (cadence.type === "daily") {
    const today = startOfDayZoned(now, tz);
    const win = new Date(today); win.setUTCHours(cadence.hour, cadence.minute, 0, 0);
    const sentToday = lastSent && startOfDayZoned(lastSent, tz).getTime() === today.getTime();
    return { shouldSend: !sentToday && zonedNow >= win, windowStart: win };
  }
  if (cadence.type === "weekly") {
    const dow = typeof cadence.dayOfWeek === "number" ? cadence.dayOfWeek : 2;
    const due = nextWeeklyOnOrAfter(now, tz, dow, cadence.hour, cadence.minute);
    const lastWin = lastSent ? nextWeeklyOnOrAfter(lastSent, tz, dow, cadence.hour, cadence.minute) : null;
    const sentThisWin = lastWin && lastSent >= lastWin;
    return { shouldSend: !sentThisWin && zonedNow >= due, windowStart: due };
  }
  if (cadence.type === "weekly-multi") {
    const days = Array.isArray(cadence.daysOfWeek) ? cadence.daysOfWeek
             : Array.isArray(vendor.daysOfWeek) ? vendor.daysOfWeek : [];
    const today = startOfDayZoned(now, tz);
    const win = new Date(today); win.setUTCHours(cadence.hour, cadence.minute, 0, 0);
    const sentToday = lastSent && startOfDayZoned(lastSent, tz).getTime() === today.getTime();
    return { shouldSend: days.includes(dowNow) && !sentToday && zonedNow >= win, windowStart: win };
  }
  if (cadence.type === "every-x-weeks") {
    const interval = cadence.interval || 2;
    const target = cadence.dayOfWeek ?? 2;
    const today = startOfDayZoned(now, tz);
    const lastStart = lastSent ? startOfDayZoned(lastSent, tz) : null;
    const diffWeeks = lastStart ? Math.floor((today - lastStart) / (1000 * 60 * 60 * 24 * 7)) : Infinity;
    const correctWeek = diffWeeks % interval === 0;
    const win = new Date(today); win.setUTCHours(cadence.hour, cadence.minute, 0, 0);
    const sentToday = lastStart && today.getTime() === lastStart.getTime();
    return { shouldSend: correctWeek && dowNow === target && !sentToday && zonedNow >= win, windowStart: win };
  }
  if (cadence.type === "monthly") {
    const dom = cadence.dayOfMonth ?? 1;
    const due = nextMonthlyOnOrAfter(now, tz, dom, cadence.hour, cadence.minute);
    const lastWin = lastSent ? nextMonthlyOnOrAfter(lastSent, tz, dom, cadence.hour, cadence.minute) : null;
    const sentThisWin = lastWin && lastSent >= lastWin;
    return { shouldSend: !sentThisWin && zonedNow >= due, windowStart: due };
  }
  return { shouldSend: false, windowStart: null };
}

// ==== Microsoft Graph mail (token reuse + retry) ====
let cachedToken = null;
let cachedTokenExp = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExp - 60_000) return cachedToken;
  const resp = await axios.post(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      scope: "https://graph.microsoft.com/.default",
      client_secret: AZURE_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  cachedToken = resp.data.access_token;
  cachedTokenExp = now + (resp.data.expires_in || 3600) * 1000;
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
      const retryAfter = parseInt(e.response?.headers?.["retry-after"] || "0", 10);
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
      body: { contentType: "HTML", content: bodyHtml },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    },
    saveToSentItems: true,
  };
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SMTP_USER)}/sendMail`;
  const res = await graphPostWithRetry(url, message, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });
  return res.status; // 202 on success
}

// ==== The job ====
async function runJob() {
  const db = await getDb();
  const vendors = db.collection("Vendors");
  const orders = db.collection("Orders");
  const now = new Date();

  const cursor = vendors.find({});
  while (await cursor.hasNext()) {
    const vendor = await cursor.next();
    const { shouldSend, windowStart } = evaluateCadenceDue(vendor, now);
    const label = vendor.vendorName || `(vendor:${vendor._id})`;

    if (!shouldSend) {
      console.log(`⏩ Skip ${label} — cadence not due`);
      continue;
    }

    const items = await orders.find({ vendorName: vendor.vendorName, isActive: true }).toArray();
    if (!items.length) {
      console.log(`📭 Skip ${label} — no active orders`);
      continue;
    }

    const listHtml = items.map(o => `<li>${o.productName} (Qty: ${o.productOrderQuantity ?? 1})</li>`).join("");
    const emailBody = `
      <p>Hello ${vendor.vendorName},</p>
      <p>Here is a list of items we would like to procure from you:</p>
      <ul>${listHtml}</ul>
      <p>Regards,<br>Mitchell Bolton<br>Seattle Biomimetic Dentistry</p>
    `;

    try {
      const status = await sendMailGraphAPI(vendor.vendorEmail, `Orders for ${vendor.vendorName}`, emailBody);
      console.log(`✅ Sent to ${vendor.vendorEmail} — HTTP ${status}`);

      const ids = items.map(o => (o._id instanceof ObjectId ? o._id : new ObjectId(o._id)));
      await orders.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
      await vendors.updateOne({ _id: vendor._id }, { $set: { lastEmailSent: now, lastEmailWindowStart: windowStart ?? null } });
    } catch (e) {
      const status = e.response?.status;
      const reqId = e.response?.headers?.["request-id"] || e.response?.headers?.["x-ms-ags-diagnostic"];
      console.error(`❌ Failed for ${vendor.vendorEmail} — status:${status} reqId:${reqId} msg:${e.message}`);
      if (e.response?.data) console.error("   Graph:", JSON.stringify(e.response.data));
      // Do not mutate DB on failure
    }
  }
}

// === ✅ Default export required by Vercel ===
export default async function handler(req, res) {
  try {
    await runJob();
    res.status(200).json({ ok: true, message: "Vendor email job completed", at: new Date().toISOString() });
  } catch (err) {
    console.error("💥 send_vendor_email failed:", err);
    res.status(500).json({ ok: false, error: err.message || "Server error", at: new Date().toISOString() });
  }
}