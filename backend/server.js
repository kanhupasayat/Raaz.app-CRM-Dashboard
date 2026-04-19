const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const connectDB = require("./db");
const { fetchProshipDeliveries } = require("./lib/proship");

dotenv.config();
connectDB();

// --- Simple in-memory cache ---
const cache = {};
function getCached(key, ttlMs) {
  const entry = cache[key];
  if (entry && Date.now() - entry.time < ttlMs) return entry.data;
  return null;
}
function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}
const CACHE_1MIN = 60 * 1000;
const CACHE_2MIN = 2 * 60 * 1000;

const app = express();
const PORT = process.env.PORT || 5000;

// API Call Counter
const apiCallCounter = {
  zoho: 0,
  proship: 0,
  tataTele: 0,
  total: 0,
  startTime: new Date().toISOString(),
};

function countCall(service) {
  apiCallCounter[service] = (apiCallCounter[service] || 0) + 1;
  apiCallCounter.total++;
}

// Make counter accessible to routes
app.use((req, res, next) => {
  req.countCall = countCall;
  next();
});

// CORS — allow localhost dev + production frontend URLs (comma-separated in FRONTEND_URL)
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
allowedOrigins.push("http://localhost:3000", "http://localhost:3001");

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow any *.vercel.app preview deployment
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// Zoho API routes
const zohoRoutes = require("./routes/zoho");
app.use("/api/zoho", zohoRoutes);

// Proship deliveries route (cached 2 min)
app.get("/api/proship/deliveries", async (req, res) => {
  try {
    const cached = getCached("proship", CACHE_2MIN);
    if (cached) return res.json(cached);

    const result = await fetchProshipDeliveries(countCall);
    setCache("proship", result);
    res.json(result);
  } catch (error) {
    console.error("Proship delivery error:", error.message);
    res.status(500).json({ error: error.message, count: 0, deliveries: [] });
  }
});

// Tata Tele: Today's call records (cached 1 min)
app.get("/api/tatatele/calls", async (req, res) => {
  try {
    const cached = getCached("tataTele", CACHE_1MIN);
    if (cached) return res.json(cached);

    const token = process.env.TATA_TELE_TOKEN;
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const today = ist.toISOString().split("T")[0];

    // Fetch call records without date filter (date filter broken in API)
    // Records come latest first, so we stop when we hit yesterday's data
    let todayCalls = [];
    let page = 1;
    let hasMore = true;
    const PAGE_SIZE = 200;
    const MAX_PAGES = 80; // Max 16000 records — covers full day

    while (hasMore && page <= MAX_PAGES) {
      countCall("tataTele");
      const response = await axios.get(
        "https://api-smartflo.tatateleservices.com/v1/call/records",
        {
          params: { limit: PAGE_SIZE, page: page },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const records = response.data?.results || [];
      if (records.length === 0) {
        hasMore = false;
        break;
      }

      for (const call of records) {
        const callDate = (call.date || "").slice(0, 10);
        if (callDate === today) {
          todayCalls.push(call);
        } else if (callDate < today) {
          hasMore = false;
          break;
        }
      }

      if (hasMore) page++;
    }

    // Build call details map: phone (last 10 digits) → latest call info
    // Records are latest-first, so the first record we see per number is the most recent.
    // Only overwrite if we haven't stored an answered call yet AND the new one is answered
    // (upgrades missed/failed → answered, but never replaces a newer answered with an older one).
    const callDetailsMap = {};
    todayCalls.forEach((call) => {
      const num = (call.client_number || "").replace(/\D/g, "").slice(-10);
      if (num.length !== 10) return;

      const existing = callDetailsMap[num];
      const isAnswered = call.status === "answered";

      if (!existing) {
        callDetailsMap[num] = {
          agentName: call.agent_name || "",
          status: call.status || "",
          direction: call.direction || "",
          duration: call.call_duration || 0,
          answeredSeconds: call.answered_seconds || 0,
          time: call.time || "",
        };
      } else if (existing.status !== "answered" && isAnswered) {
        callDetailsMap[num] = {
          agentName: call.agent_name || "",
          status: call.status || "",
          direction: call.direction || "",
          duration: call.call_duration || 0,
          answeredSeconds: call.answered_seconds || 0,
          time: call.time || "",
        };
      }
    });

    const result = {
      totalCalls: todayCalls.length,
      calledNumbers: Object.keys(callDetailsMap),
      callDetails: callDetailsMap,
    };
    setCache("tataTele", result);
    res.json(result);
  } catch (error) {
    console.error("Tata Tele error:", error.message);
    res.status(500).json({ error: error.message, totalCalls: 0, calledNumbers: [], callDetails: {} });
  }
});

// Tata Tele: CSV Call Report — outgoing calls for given numbers in date range
app.post("/api/tatatele/csv-report", async (req, res) => {
  try {
    const { numbers, fromDate, toDate } = req.body;
    if (!numbers || !numbers.length || !fromDate || !toDate) {
      return res.status(400).json({ error: "numbers, fromDate, toDate required" });
    }

    const token = process.env.TATA_TELE_TOKEN;

    // Normalize all input numbers to last 10 digits
    const normalizedNumbers = new Set(
      numbers.map((n) => (n || "").replace(/\D/g, "").slice(-10)).filter((n) => n.length === 10)
    );

    // Fetch call records with date filter, paginating through all pages
    let relevantCalls = [];
    let page = 1;
    let hasMore = true;
    const MAX_PAGES = 150;

    while (hasMore && page <= MAX_PAGES) {
      countCall("tataTele");
      const response = await axios.get(
        "https://api-smartflo.tatateleservices.com/v1/call/records",
        {
          params: { limit: 200, page, from_date: fromDate, to_date: toDate },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const records = response.data?.results || [];
      if (records.length === 0) break;

      for (const call of records) {
        const callDate = (call.date || "").slice(0, 10);
        // Double-check date is in range (API filter backup)
        if (callDate >= fromDate && callDate <= toDate) {
          relevantCalls.push(call);
        } else if (callDate < fromDate) {
          hasMore = false;
          break;
        }
      }

      if (hasMore) page++;
    }

    // Build per-number stats (only outgoing calls — skip inbound)
    const numberStats = {};
    for (const num of normalizedNumbers) {
      numberStats[num] = { phone: num, totalCalls: 0, answered: 0, totalSeconds: 0 };
    }

    for (const call of relevantCalls) {
      const clientNum = (call.client_number || "").replace(/\D/g, "").slice(-10);
      if (!normalizedNumbers.has(clientNum)) continue;

      // Skip inbound calls — only count outgoing
      const direction = (call.direction || "").toLowerCase();
      if (direction === "inbound") continue;

      numberStats[clientNum].totalCalls++;
      if (call.status === "answered") {
        numberStats[clientNum].answered++;
        numberStats[clientNum].totalSeconds += call.answered_seconds || 0;
      }
    }

    const results = Array.from(normalizedNumbers).map((num) => numberStats[num]);

    res.json({
      totalNumbers: results.length,
      totalApiPages: page,
      totalCallsScanned: relevantCalls.length,
      data: results,
    });
  } catch (error) {
    console.error("CSV report error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// API Call Counter endpoint
app.get("/api/stats", (req, res) => {
  res.json(apiCallCounter);
});

app.get("/", (req, res) => {
  res.json({ message: "CRM Dashboard Backend Running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
