import React, { useState, useEffect } from "react";
import { useCallData } from "../CallContext";
import SkeletonTable from "./SkeletonTable";

function formatTime(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date)) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date)) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Normalize phone to last 10 digits for matching
function normPhone(phone) {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

// Format seconds to readable duration
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function getCallStatusLabel(status) {
  if (!status) return "Called";
  if (status === "answered") return "Answered";
  if (status === "missed") return "Not Received";
  if (status === "failed") return "Failed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Today's date in IST as YYYY-MM-DD
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function formatDateLabel(d) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  if (isNaN(date)) return d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Module-level cache — persists across page navigations
let pageCache = null; // { startDate, endDate, data }

function AssessmentPage() {
  const { calledNumbers, callDetails, fetchCalls } = useCallData();
  const today = getTodayIST();
  const [startDate, setStartDate] = useState(pageCache?.startDate || today);
  const [endDate, setEndDate] = useState(pageCache?.endDate || today);
  const [appliedRange, setAppliedRange] = useState(
    pageCache ? { startDate: pageCache.startDate, endDate: pageCache.endDate } : { startDate: today, endDate: today }
  );
  const [data, setData] = useState(pageCache?.data || []);
  const [loading, setLoading] = useState(!pageCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [durationFilter, setDurationFilter] = useState("all");
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    fetchData(appliedRange.startDate, appliedRange.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (sd, ed) => {
    if (!sd || !ed) {
      setError("From aur To date dono select karo.");
      return;
    }
    if (sd > ed) {
      setError("From date To date se badi nahi ho sakti.");
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const url = `${process.env.REACT_APP_API_URL}/api/zoho/assessment-contacts?startDate=${sd}&endDate=${ed}`;
      const [assessRes] = await Promise.all([fetch(url), fetchCalls()]);
      const result = await assessRes.json();
      const newData = result.data || [];
      setData(newData);
      setAppliedRange({ startDate: sd, endDate: ed });
      pageCache = { startDate: sd, endDate: ed, data: newData };
    } catch (err) {
      console.error("Assessment fetch error:", err);
      setError("Data fetch failed! Server check karo.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleApply = () => fetchData(startDate, endDate);
  const handleRefresh = () => fetchData(appliedRange.startDate, appliedRange.endDate);

  const copyPhone = (phone, index) => {
    const cleaned = phone.replace(/\D/g, "");
    navigator.clipboard.writeText(cleaned).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  const calledSet = new Set((calledNumbers || []).map((n) => normPhone(n)));

  // Enrich data with call info
  const enriched = data.map((d) => {
    const phoneNorm = normPhone(d.phone);
    const isCalled = calledSet.has(phoneNorm);
    const callInfo = callDetails[phoneNorm] || null;
    return {
      ...d,
      called: isCalled,
      agentName: callInfo?.agentName || "",
      callStatus: callInfo?.status || "",
      duration: callInfo?.duration || 0,
      answeredSeconds: callInfo?.answeredSeconds || 0,
      recordingUrl: callInfo?.recordingUrl || "",
    };
  });

  const totalCalled = enriched.filter((d) => d.called).length;
  const totalNotCalled = enriched.length - totalCalled;

  let list = enriched;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (d) =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.phone || "").includes(q)
    );
  }

  // Duration filter (uses answered seconds, falls back to total duration)
  if (durationFilter !== "all") {
    list = list.filter((d) => {
      if (durationFilter === "notCalled") return !d.called;
      if (!d.called) return false;
      const sec = d.answeredSeconds || d.duration || 0;
      switch (durationFilter) {
        case "lt30": return sec > 0 && sec < 30;
        case "30to60": return sec >= 30 && sec < 60;
        case "1to3": return sec >= 60 && sec < 180;
        case "3to5": return sec >= 180 && sec < 300;
        case "gt5": return sec >= 300;
        default: return true;
      }
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Assessment Contacts</h1>
          <span className="header-date">
            {appliedRange.startDate === appliedRange.endDate
              ? formatDateLabel(appliedRange.startDate)
              : `${formatDateLabel(appliedRange.startDate)} → ${formatDateLabel(appliedRange.endDate)}`}
          </span>
        </div>
        <div className="header-stats">
          <span className="stat-pill blue">{data.length} Total</span>
          <span className="stat-pill" style={{ background: "#d4edda", color: "#155724" }}>{totalCalled} Called</span>
          <span className="stat-pill" style={{ background: "#f8d7da", color: "#721c24" }}>{totalNotCalled} Not Called</span>
        </div>
      </header>

      {error && (
        <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px 24px", textAlign: "center", fontWeight: 600, fontSize: 14 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 16, background: "none", border: "1px solid #721c24", color: "#721c24", borderRadius: 4, padding: "2px 10px", cursor: "pointer" }}>
            Dismiss
          </button>
        </div>
      )}

      <div className="team-page">
        <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
          Filters: Appointment = Today | Tag = Assessment Completed | Last Delivery Date = Empty | Latest Assessment Time = Not Empty | Latest Payment Date = Empty
        </div>

        <div className="team-filters" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>From Date</label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>To Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>

          <button
            className="section-refresh-btn leads"
            onClick={handleApply}
            disabled={refreshing}
            style={{ height: 38 }}
          >
            {refreshing ? "Loading..." : "Apply"}
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Duration</label>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14, background: "#fff", height: 38 }}
            >
              <option value="all">All</option>
              <option value="notCalled">Not Called</option>
              <option value="lt30">Less than 30 sec</option>
              <option value="30to60">30 sec – 1 min</option>
              <option value="1to3">1 – 3 min</option>
              <option value="3to5">3 – 5 min</option>
              <option value="gt5">5+ min</option>
            </select>
          </div>

          <input
            type="text"
            className="team-search"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            className="section-refresh-btn leads"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ height: 38 }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <SkeletonTable columns={10} rows={8} />
        ) : list.length > 0 ? (
          <table className="data-table team-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Appointment Time</th>
                <th>Last Assessment</th>
                <th>Call Status</th>
                <th>Agent</th>
                <th>Duration</th>
                <th>Result</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, i) => (
                <tr key={d.id || i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{d.name || "-"}</td>
                  <td>
                    {d.phone ? (
                      <div className="phone-cell">
                        <span>{d.phone}</span>
                        <button
                          className={`copy-btn ${copiedIndex === i ? "copied" : ""}`}
                          onClick={() => copyPhone(d.phone, i)}
                        >
                          {copiedIndex === i ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                  <td>{formatTime(d.appointment)}</td>
                  <td>{formatDateTime(d.latestAssessmentTime)}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: d.called ? "#d4edda" : "#f8d7da",
                        color: d.called ? "#155724" : "#721c24",
                      }}
                    >
                      {d.called ? "Called" : "Not Called"}
                    </span>
                  </td>
                  <td>{d.called ? d.agentName || "-" : "-"}</td>
                  <td>{d.called ? formatDuration(d.answeredSeconds || d.duration) : "-"}</td>
                  <td>
                    {d.called ? (
                      <span
                        className="badge"
                        style={{
                          background: d.callStatus === "answered" ? "#cce5ff" : "#fff3cd",
                          color: d.callStatus === "answered" ? "#004085" : "#856404",
                        }}
                      >
                        {getCallStatusLabel(d.callStatus)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {d.recordingUrl ? (
                      <audio
                        controls
                        preload="none"
                        src={d.recordingUrl}
                        style={{ height: 32, maxWidth: 220 }}
                      />
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">
            {enriched.length > 0
              ? "No contacts match the current filters"
              : "No assessment contacts found for selected date range"}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssessmentPage;
