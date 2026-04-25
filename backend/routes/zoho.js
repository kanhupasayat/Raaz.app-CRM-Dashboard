const express = require("express");
const axios = require("axios");
const router = express.Router();
const teamMembers = require("../teamMembers");

let accessToken = null;
let tokenExpiry = null;

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
const CACHE_TTL = 2 * 60 * 1000; // 2 min default
const STAFF_CACHE_TTL = 5 * 60 * 1000; // 5 min for staff deliveries

// Count API call helper (from req)
let countCall = () => {};
router.use((req, res, next) => {
  if (req.countCall) countCall = req.countCall;
  next();
});

// Token refresh
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  countCall("zoho");
  const response = await axios.post(
    `${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
    null,
    {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token",
      },
    }
  );

  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return accessToken;
}

// Aaj ka date (IST)
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Users — hardcoded teamMembers.js se (0 API call)
router.get("/users", (req, res) => {
  res.json({ users: teamMembers });
});

// Zoho Call 1: Leads fetch (cached 2 min)
router.get("/leads", async (req, res) => {
  try {
    const cached = getCached("leads", CACHE_TTL);
    if (cached) return res.json(cached);

    const token = await getAccessToken();
    countCall("zoho");
    const response = await axios.get(
      `${process.env.ZOHO_API_DOMAIN}/crm/v2/Leads`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: {
          fields: "Full_Name,Owner,Email,Phone,Lead_Status,Created_Time",
          sort_by: "Created_Time",
          sort_order: "desc",
          per_page: 200,
        },
      }
    );

    const today = getTodayIST();
    const allData = response.data?.data || [];
    const todayData = allData.filter((item) =>
      item.Created_Time.startsWith(today)
    );

    const result = { data: todayData, info: { count: todayData.length } };
    setCache("leads", result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zoho Call 2: Contacts fetch — Appointment_Schedule = today AND Created_Time before today (cached 2 min)
router.get("/contacts", async (req, res) => {
  try {
    const cached = getCached("contacts", CACHE_TTL);
    if (cached) return res.json(cached);

    const token = await getAccessToken();
    const today = getTodayIST();

    // Fetch all contacts sorted by Appointment_Schedule desc, collect today's
    let allData = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      countCall("zoho");
      const response = await axios.get(
        `${process.env.ZOHO_API_DOMAIN}/crm/v2/Contacts`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
          params: {
            fields: "Full_Name,Owner,Phone,Appointment_Schedule,Created_Time",
            sort_by: "Appointment_Schedule",
            sort_order: "desc",
            per_page: 200,
            page: page,
          },
        }
      );

      const records = response.data?.data || [];
      for (const c of records) {
        const appt = c.Appointment_Schedule || "";
        if (appt.startsWith(today)) {
          if (!c.Created_Time?.startsWith(today)) {
            allData.push(c);
          }
        } else if (appt && appt < today) {
          hasMore = false;
          break;
        }
      }

      if (hasMore && response.data?.info?.more_records) {
        page++;
      } else {
        hasMore = false;
      }
    }

    const result = { data: allData, info: { count: allData.length } };
    setCache("contacts", result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const Onboarding = require("../models/Onboarding");
const { fetchProshipDeliveries } = require("../lib/proship");

// Zoho Call: Onboarding — Proship deliveries + Zoho deal data (saved to DB) (cached 2 min)
router.get("/onboarding", async (req, res) => {
  try {
    const cached = getCached("onboarding", CACHE_TTL);
    if (cached) return res.json(cached);

    const token = await getAccessToken();
    const today = getTodayIST();

    // Step 1: Get today's deliveries from Proship (direct function call — no self HTTP request)
    const proshipResult = await fetchProshipDeliveries(countCall);
    const deliveries = proshipResult?.deliveries || [];

    let newApiCalls = 0;

    // Step 2: For each delivery, check DB or fetch from Zoho
    for (const d of deliveries) {
      const awb = d.awb || "";
      if (!awb) continue;

      // Already in DB? Skip API call
      const exists = await Onboarding.findOne({ awb });
      if (exists) continue;

      // New AWB — search in Zoho Deals
      try {
        countCall("zoho");
        newApiCalls++;
        const zohoRes = await axios.get(
          `${process.env.ZOHO_API_DOMAIN}/crm/v2/Deals/search`,
          {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
            params: {
              word: awb,
              fields: "Phone,Contact_Name,Plan_Name,Deal_Name,tracking_url",
            },
          }
        );

        const deal = (zohoRes.data?.data || [])[0];
        await Onboarding.create({
          awb,
          orderId: d.orderId || "",
          customerName: deal?.Contact_Name?.name || d.customerName || "",
          phone: deal?.Phone || "",
          planName: deal?.Plan_Name || "",
          dealId: deal?.id || "",
          dealLink: deal?.id ? `https://crm.zoho.in/crm/org60023577271/tab/Potentials/${deal.id}` : "",
          deliveryDate: d.deliveryDate || "",
          city: d.city || "",
          courier: d.courier || "",
          invoiceValue: d.invoiceValue || 0,
          date: today,
        });
      } catch (err) {
        // Save delivery info even if Zoho search fails
        try {
          await Onboarding.create({
            awb,
            orderId: d.orderId || "",
            customerName: d.customerName || "",
            date: today,
            deliveryDate: d.deliveryDate || "",
            city: d.city || "",
            courier: d.courier || "",
            invoiceValue: d.invoiceValue || 0,
          });
        } catch (dbErr) {}
      }
    }

    // Step 3: Return today's data from DB
    const results = await Onboarding.find({ date: today }).sort({ createdAt: -1 });

    const result = { count: results.length, newApiCalls, data: results };
    setCache("onboarding", result);
    res.json(result);
  } catch (error) {
    console.error("Onboarding error:", error.message);
    res.status(500).json({ error: error.message, count: 0, data: [] });
  }
});

// Update onboarding status (staff action) — clears onboarding cache
router.put("/onboarding/:id", async (req, res) => {
  try {
    delete cache["onboarding"];
    const { onboardingStatus, notes, calledBy, followUpDate, followUpReason } = req.body;
    const update = { updatedAt: new Date() };
    if (onboardingStatus) update.onboardingStatus = onboardingStatus;
    if (notes !== undefined) update.notes = notes;
    if (calledBy) update.calledBy = calledBy;
    if (onboardingStatus === "called" || onboardingStatus === "explained") update.calledAt = new Date();
    if (followUpDate) update.followUpDate = followUpDate;
    if (followUpReason) update.followUpReason = followUpReason;

    const doc = await Onboarding.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get follow-ups for today
router.get("/followups", async (req, res) => {
  try {
    const today = getTodayIST();
    const followups = await Onboarding.find({
      followUpDate: { $lte: new Date(today + "T23:59:59.999Z") },
      onboardingStatus: "follow_up",
    }).sort({ followUpDate: 1 });

    res.json({ count: followups.length, data: followups });
  } catch (error) {
    res.status(500).json({ error: error.message, count: 0, data: [] });
  }
});

// Assessment Contacts — filtered contacts for assessment page (cached 2 min per range)
router.get("/assessment-contacts", async (req, res) => {
  try {
    const today = getTodayIST();
    const startDate = (req.query.startDate || today).slice(0, 10);
    const endDate = (req.query.endDate || today).slice(0, 10);

    const cacheKey = `assessment_${startDate}_${endDate}`;
    const cached = getCached(cacheKey, CACHE_TTL);
    if (cached) return res.json(cached);

    const token = await getAccessToken();

    let allData = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      countCall("zoho");
      const response = await axios.get(
        `${process.env.ZOHO_API_DOMAIN}/crm/v2/Contacts`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
          params: {
            fields: "Full_Name,Phone,Appointment_Schedule,Tag,Last_Delivery_Date,Latest_Assessment_Time,Latest_Payment_Date",
            sort_by: "Appointment_Schedule",
            sort_order: "desc",
            per_page: 200,
            page: page,
          },
        }
      );

      const records = response.data?.data || [];
      for (const c of records) {
        const appt = c.Appointment_Schedule || "";
        const apptDate = appt.slice(0, 10);

        if (apptDate >= startDate && apptDate <= endDate) {
          // Filter: Tag = "Assessment Completed", Last_Delivery_Date empty, Latest_Assessment_Time not empty, Latest_Payment_Date empty
          const tags = c.Tag || [];
          const hasAssessmentTag = Array.isArray(tags) && tags.some((t) => t.name === "Assessment Completed");
          const lastDeliveryEmpty = !c.Last_Delivery_Date;
          const assessmentTimeExists = !!c.Latest_Assessment_Time;
          const paymentDateEmpty = !c.Latest_Payment_Date;

          if (hasAssessmentTag && lastDeliveryEmpty && assessmentTimeExists && paymentDateEmpty) {
            allData.push({
              id: c.id,
              name: c.Full_Name || "",
              phone: c.Phone || "",
              appointment: c.Appointment_Schedule || "",
              latestAssessmentTime: c.Latest_Assessment_Time || "",
            });
          }
        } else if (appt && apptDate < startDate) {
          // Records sorted desc — anything older than startDate means we're done
          hasMore = false;
          break;
        }
      }

      if (hasMore && response.data?.info?.more_records) {
        page++;
      } else {
        hasMore = false;
      }
    }

    // Sort by appointment time
    allData.sort((a, b) => (a.appointment || "").localeCompare(b.appointment || ""));

    const result = { count: allData.length, data: allData, startDate, endDate };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Assessment contacts error:", error.message);
    res.status(500).json({ error: error.message, count: 0, data: [] });
  }
});

// Staff Delivery Report — Contacts filtered by Owner + Last_Delivery_Date range (cached 5 min per search)
router.get("/staff-deliveries", async (req, res) => {
  try {
    const { ownerId, startDate, endDate } = req.query;
    if (!ownerId || !startDate || !endDate) {
      return res.status(400).json({ error: "ownerId, startDate, endDate required", count: 0, data: [] });
    }

    const cacheKey = `staff_${ownerId}_${startDate}_${endDate}`;
    const cached = getCached(cacheKey, STAFF_CACHE_TTL);
    if (cached) return res.json(cached);

    const token = await getAccessToken();

    // Generate all dates between startDate and endDate
    const dates = [];
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    let allData = [];

    // Fetch contacts for each date (equals operator works on date fields)
    for (const date of dates) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          countCall("zoho");
          const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/crm/v2/Contacts/search`,
            {
              headers: { Authorization: `Zoho-oauthtoken ${token}` },
              params: {
                criteria: `((Owner:equals:${ownerId})and(Last_Delivery_Date:equals:${date}))`,
                fields: "Full_Name,Phone,Last_Delivery_Date,Plan_Name,Owner,Email",
                per_page: 200,
                page: page,
              },
            }
          );

          const records = response.data?.data || [];
          allData.push(...records.map((c) => ({
            id: c.id,
            name: c.Full_Name || "",
            phone: c.Phone || "",
            email: c.Email || "",
            lastDeliveryDate: c.Last_Delivery_Date || "",
            planName: c.Plan_Name || "",
            owner: c.Owner?.name || "",
          })));

          if (response.data?.info?.more_records) {
            page++;
          } else {
            hasMore = false;
          }
        } catch (err) {
          // 404/204 means no results for this date — skip
          if (err.response?.status === 404 || err.response?.status === 204) {
            hasMore = false;
          } else {
            throw err;
          }
        }
      }
    }

    // Sort by Last_Delivery_Date desc
    allData.sort((a, b) => (b.lastDeliveryDate || "").localeCompare(a.lastDeliveryDate || ""));

    const result = { count: allData.length, data: allData };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Staff deliveries error:", error.message);
    res.status(500).json({ error: error.message, count: 0, data: [] });
  }
});

// Deal lookup by phone number — returns deals + Followup Dates fields
router.get("/deals-by-phone", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "phone query param required" });
    }

    const token = await getAccessToken();
    let apiCalls = 0;

    // Build phone variants: raw, with 91, without 91
    const raw = phone.replace(/\D/g, "");
    const variants = [];
    if (raw.startsWith("91") && raw.length === 12) {
      variants.push(raw, raw.slice(2));
    } else if (raw.length === 10) {
      variants.push(raw, "91" + raw);
    } else {
      variants.push(raw);
    }

    let deals = [];
    const seen = new Set();

    const addDeals = (found) => {
      for (const d of found) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          deals.push(d);
        }
      }
    };

    const safeSearch = async (module, params) => {
      try {
        countCall("zoho");
        apiCalls++;
        const response = await axios.get(
          `${process.env.ZOHO_API_DOMAIN}/crm/v2/${module}/search`,
          {
            headers: { Authorization: `Zoho-oauthtoken ${token}` },
            params: { ...params, per_page: 200 },
          }
        );
        return response.data?.data || [];
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 204) {
          return [];
        }
        throw err;
      }
    };

    // Step 1: Search Deals directly by phone (starts_with)
    for (const variant of variants) {
      if (deals.length > 0) break;
      const found = await safeSearch("Deals", { criteria: `(Phone:starts_with:${variant})` });
      addDeals(found);
    }

    // Step 2: If no deals found, search via Contacts → get their deals
    if (deals.length === 0) {
      let contactIds = [];
      for (const variant of variants) {
        if (contactIds.length > 0) break;
        // Try phone field on Contacts
        const contacts = await safeSearch("Contacts", { phone: variant });
        contactIds = contacts.map((c) => c.id);
      }

      // For each contact, fetch related deals
      for (const contactId of contactIds) {
        try {
          countCall("zoho");
          apiCalls++;
          const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/crm/v2/Contacts/${contactId}/Deals`,
            {
              headers: { Authorization: `Zoho-oauthtoken ${token}` },
              params: { per_page: 200 },
            }
          );
          addDeals(response.data?.data || []);
        } catch (err) {
          if (err.response?.status !== 404 && err.response?.status !== 204) {
            throw err;
          }
        }
      }
    }

    // Step 3: If still nothing, try word search on Deals
    if (deals.length === 0) {
      for (const variant of variants) {
        if (deals.length > 0) break;
        const found = await safeSearch("Deals", { word: variant });
        addDeals(found);
      }
    }

    res.json({
      phone,
      totalDeals: deals.length,
      apiCalls,
      deals: deals.map((d) => ({
        id: d.id,
        Deal_Name: d.Deal_Name || "nil",
        Stage: d.Stage || "nil",
        Phone: d.Phone || "nil",
        Contact_Name: d.Contact_Name?.name || d.Contact_Name || "nil",
        Onboarding_Call_Done: d.Onboarding_Call_Done || "nil",
        Onboarding_Date: d.Onboarding_Date || "nil",
        Medicine_Start_date: d.Medicine_Start_date || "nil",
        Followup_Date: d.Followup_Date || "nil",
      })),
    });
  } catch (error) {
    console.error("Deals by phone error:", error.message);
    res.status(500).json({ error: error.message, phone, totalDeals: 0, apiCalls: 0, deals: [] });
  }
});

module.exports = router;
