import React, { useState, useEffect } from "react";
import { useCallData } from "../CallContext";
import SkeletonTable from "./SkeletonTable";

function normPhone(phone) {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function formatDeliveryTime(dateStr) {
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

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", bg: "#fff3cd", color: "#856404" },
  { value: "called", label: "Called", bg: "#cce5ff", color: "#004085" },
  { value: "explained", label: "Explained", bg: "#d4edda", color: "#155724" },
  { value: "not_reachable", label: "Not Reachable", bg: "#f8d7da", color: "#721c24" },
  { value: "follow_up", label: "Follow Up", bg: "#e2d9f3", color: "#5a2d82" },
];

// Module-level cache — persists across page navigations
let pageCache = { data: null, followUps: null, apiStats: null };

function OnboardingPage() {
  const { calledNumbers, callDetails, fetchCalls } = useCallData();
  const [data, setData] = useState(pageCache.data || []);
  const [loading, setLoading] = useState(!pageCache.data);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [apiStats, setApiStats] = useState(pageCache.apiStats);
  const [followUps, setFollowUps] = useState(pageCache.followUps || []);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [checkingCalls, setCheckingCalls] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [onboardingRes, , statsRes, followUpRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/onboarding`),
        fetchCalls(),
        fetch(`${process.env.REACT_APP_API_URL}/api/stats`),
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/followups`),
      ]);

      const onboarding = await onboardingRes.json();
      const stats = await statsRes.json();
      const followUpData = await followUpRes.json();

      const newData = onboarding.data || [];
      const newFollowUps = followUpData.data || [];
      setData(newData);
      setApiStats(stats);
      setFollowUps(newFollowUps);
      pageCache = { data: newData, followUps: newFollowUps, apiStats: stats };
    } catch (err) {
      console.error("Onboarding fetch error:", err);
      setError("Onboarding data fetch failed! Server check karo.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  // Sirf Tata Tele call data refresh — 0 Zoho/Proship calls
  const checkCalls = async () => {
    setCheckingCalls(true);
    try {
      const [, statsRes] = await Promise.all([
        fetchCalls(),
        fetch(`${process.env.REACT_APP_API_URL}/api/stats`),
      ]);
      const stats = await statsRes.json();
      setApiStats(stats);
    } catch (err) {
      console.error("Check calls error:", err);
      setError("Call data fetch failed!");
    }
    setCheckingCalls(false);
  };

  const updateStatus = async (id, onboardingStatus, extra = {}) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/zoho/onboarding/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingStatus, ...extra }),
      });
      const updated = await res.json();
      setData((prev) => prev.map((d) => (d._id === id ? updated : d)));
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleFollowUp = async (id) => {
    const days = prompt("Kitne din baad follow-up karna hai?", "10");
    if (!days) return;
    const reason = prompt("Follow-up reason (optional):", "Upsell - bigger plan");
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + parseInt(days));
    await updateStatus(id, "follow_up", {
      followUpDate: followUpDate.toISOString(),
      followUpReason: reason || "",
    });
  };

  const calledSet = new Set((calledNumbers || []).map((n) => normPhone(n)));
  const details = callDetails || {};

  // Build list with call info
  let list = data.map((d) => {
    const phoneNorm = normPhone(d.phone);
    const isCalled = phoneNorm && calledSet.has(phoneNorm);
    const callInfo = details[phoneNorm] || null;

    return {
      ...d,
      phoneNorm,
      teleCalled: isCalled,
      agentName: callInfo?.agentName || "",
      callStatus: callInfo?.status || "",
      duration: callInfo?.answeredSeconds || callInfo?.duration || 0,
    };
  });

  // Search filter
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (d) =>
        (d.customerName || "").toLowerCase().includes(q) ||
        (d.phone || "").includes(q) ||
        (d.planName || "").toLowerCase().includes(q) ||
        (d.awb || "").includes(q)
    );
  }

  // Status filter
  if (filter === "pending") list = list.filter((d) => d.onboardingStatus === "pending");
  if (filter === "explained") list = list.filter((d) => d.onboardingStatus === "explained");
  if (filter === "follow_up") list = list.filter((d) => d.onboardingStatus === "follow_up");
  if (filter === "not_reachable") list = list.filter((d) => d.onboardingStatus === "not_reachable");

  const statusCounts = {
    pending: data.filter((d) => d.onboardingStatus === "pending").length,
    explained: data.filter((d) => d.onboardingStatus === "explained").length,
    follow_up: data.filter((d) => d.onboardingStatus === "follow_up").length,
    not_reachable: data.filter((d) => d.onboardingStatus === "not_reachable").length,
  };

  const copyPhone = (phone, index) => {
    const cleaned = phone.replace(/\D/g, "");
    navigator.clipboard.writeText(cleaned).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Onboarding - Today's Deliveries</h1>
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
          <span className="stat-pill" style={{ background: "#fff3cd", color: "#856404" }}>{statusCounts.pending} Pending</span>
          <span className="stat-pill green">{statusCounts.explained} Done</span>
          <span className="stat-pill" style={{ background: "#e2d9f3", color: "#5a2d82" }}>{statusCounts.follow_up} Follow Up</span>
          <span className="stat-pill red">{statusCounts.not_reachable} Not Reachable</span>
          <span className="stat-pill blue">{data.length} Total</span>
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
        {/* API Stats Bar */}
        {apiStats && (
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#888" }}>API Calls:</span>
            <span className="badge" style={{ background: "#cce5ff", color: "#004085" }}>Zoho: {apiStats.zoho}</span>
            <span className="badge" style={{ background: "#d4edda", color: "#155724" }}>Proship: {apiStats.proship}</span>
            <span className="badge" style={{ background: "#e2d9f3", color: "#5a2d82" }}>Tata Tele: {apiStats.tataTele}</span>
            <span className="badge" style={{ background: "#f8f9fa", color: "#333", fontWeight: 700 }}>Total: {apiStats.total}</span>
          </div>
        )}

        {/* Follow-ups toggle */}
        {followUps.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button
              className="dropdown-toggle-btn"
              onClick={() => setShowFollowUps(!showFollowUps)}
              style={{ borderColor: "#7209b7", color: "#5a2d82" }}
            >
              {showFollowUps ? "▲ Hide" : "▼ Show"} Follow-ups Due ({followUps.length})
            </button>
            {showFollowUps && (
              <table className="data-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Delivery Date</th>
                    <th>Follow-up Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followUps.map((f, i) => (
                    <tr key={f._id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{f.customerName || "-"}</td>
                      <td>{f.phone || "-"}</td>
                      <td>{f.planName || "-"}</td>
                      <td>{f.date || "-"}</td>
                      <td>{f.followUpReason || "-"}</td>
                      <td>
                        <button className="view-btn" onClick={() => updateStatus(f._id, "explained")}>
                          Done
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="team-filters">
          <input
            type="text"
            className="team-search"
            placeholder="Search name, phone, plan, AWB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="time-filter-btns">
            {[
              { key: "all", label: `All (${data.length})` },
              { key: "pending", label: `Pending (${statusCounts.pending})` },
              { key: "explained", label: `Done (${statusCounts.explained})` },
              { key: "follow_up", label: `Follow Up (${statusCounts.follow_up})` },
              { key: "not_reachable", label: `Not Reachable (${statusCounts.not_reachable})` },
            ].map((f) => (
              <button
                key={f.key}
                className={`time-filter-btn ${filter === f.key ? "active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <button
              className="section-refresh-btn leads"
              onClick={fetchData}
              disabled={refreshing}
              style={{ marginLeft: 8 }}
            >
              {refreshing ? "Refreshing..." : "Refresh All"}
            </button>
            <button
              className="section-refresh-btn contacts"
              onClick={checkCalls}
              disabled={checkingCalls}
              style={{ marginLeft: 4 }}
            >
              {checkingCalls ? "Checking..." : "Check Calls"}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable columns={11} rows={8} />
        ) : list.length > 0 ? (
          <table className="data-table team-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Plan</th>
                <th>Delivery Time</th>
                <th>City</th>
                <th>Tele Status</th>
                <th>Agent</th>
                <th>Duration</th>
                <th>Onboarding</th>
                <th>Deal</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, i) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === d.onboardingStatus) || STATUS_OPTIONS[0];
                return (
                  <tr key={d._id || d.awb || i} className={d.onboardingStatus === "explained" ? "row-called" : ""}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.customerName || "-"}</td>
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
                    <td>
                      {d.planName ? (
                        <span className="badge" style={{ background: "#e2d9f3", color: "#5a2d82" }}>
                          {d.planName}
                        </span>
                      ) : "-"}
                    </td>
                    <td>{formatDeliveryTime(d.deliveryDate)}</td>
                    <td>{d.city || "-"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: d.teleCalled ? "#d4edda" : d.phone ? "#f8d7da" : "#fff3cd",
                          color: d.teleCalled ? "#155724" : d.phone ? "#721c24" : "#856404",
                        }}
                      >
                        {d.teleCalled ? (d.callStatus === "answered" ? "Answered" : d.callStatus === "missed" ? "Not Received" : "Called") : d.phone ? "Not Called" : "No Phone"}
                      </span>
                    </td>
                    <td>{d.teleCalled ? d.agentName || "-" : "-"}</td>
                    <td>{d.teleCalled ? formatDuration(d.duration) : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <span className="badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                        {d.onboardingStatus === "pending" && (
                          <>
                            <button className="copy-btn" onClick={() => updateStatus(d._id, "explained")} style={{ color: "#155724", borderColor: "#155724" }}>Done</button>
                            <button className="copy-btn" onClick={() => updateStatus(d._id, "not_reachable")} style={{ color: "#721c24", borderColor: "#721c24" }}>NR</button>
                            <button className="copy-btn" onClick={() => handleFollowUp(d._id)} style={{ color: "#5a2d82", borderColor: "#5a2d82" }}>FU</button>
                          </>
                        )}
                        {(d.onboardingStatus === "not_reachable" || d.onboardingStatus === "follow_up") && (
                          <button className="copy-btn" onClick={() => updateStatus(d._id, "explained")} style={{ color: "#155724", borderColor: "#155724" }}>Done</button>
                        )}
                      </div>
                    </td>
                    <td>
                      {d.dealLink ? (
                        <a href={d.dealLink} target="_blank" rel="noopener noreferrer" className="view-btn" style={{ textDecoration: "none" }}>
                          Open
                        </a>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No deliveries found</div>
        )}
      </div>
    </div>
  );
}

export default OnboardingPage;
