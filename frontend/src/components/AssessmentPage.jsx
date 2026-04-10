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

// Module-level cache — persists across page navigations
let pageCache = null;

function AssessmentPage() {
  const { calledNumbers, callDetails, fetchCalls } = useCallData();
  const [data, setData] = useState(pageCache || []);
  const [loading, setLoading] = useState(!pageCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [assessRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/assessment-contacts`),
        fetchCalls(),
      ]);
      const result = await assessRes.json();
      const newData = result.data || [];
      setData(newData);
      pageCache = newData;
    } catch (err) {
      console.error("Assessment fetch error:", err);
      setError("Data fetch failed! Server check karo.");
    }
    setLoading(false);
    setRefreshing(false);
  };

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Assessment Contacts</h1>
          <span className="header-date">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
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

        <div className="team-filters">
          <input
            type="text"
            className="team-search"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="section-refresh-btn leads"
            onClick={fetchData}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <SkeletonTable columns={9} rows={8} />
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
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No assessment contacts found for today</div>
        )}
      </div>
    </div>
  );
}

export default AssessmentPage;
