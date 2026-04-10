import React, { useState, useEffect } from "react";
import { useCallData } from "../CallContext";
import SkeletonTable from "./SkeletonTable";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date)) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Get today IST as YYYY-MM-DD
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Normalize phone to last 10 digits
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

function getCallStatusLabel(status) {
  if (!status) return "Called";
  if (status === "answered") return "Answered";
  if (status === "missed") return "Not Received";
  if (status === "failed") return "Failed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StaffReportPage() {
  const { calledNumbers, callDetails, fetchCalls } = useCallData();
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Load team members
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/zoho/users`)
      .then((r) => r.json())
      .then((d) => setTeamMembers(d.users || []))
      .catch(() => {});
  }, []);

  // Set default dates: start = 1st of current month, end = today
  useEffect(() => {
    const today = getTodayIST();
    const monthStart = today.slice(0, 8) + "01";
    setStartDate(monthStart);
    setEndDate(today);
  }, []);

  const fetchReport = async () => {
    if (!selectedOwner) {
      setError("Staff member select karo!");
      return;
    }
    if (!startDate || !endDate) {
      setError("Date range select karo!");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const [res] = await Promise.all([
        fetch(
          `${process.env.REACT_APP_API_URL}/api/zoho/staff-deliveries?ownerId=${selectedOwner}&startDate=${startDate}&endDate=${endDate}`
        ),
        fetchCalls(),
      ]);
      const result = await res.json();
      if (result.error && !result.data) {
        setError(result.error);
        setData([]);
      } else {
        setData(result.data || []);
      }
    } catch (err) {
      console.error("Staff report error:", err);
      setError("Data fetch failed! Server check karo.");
      setData([]);
    }
    setLoading(false);
  };

  const copyPhone = (phone, index) => {
    const cleaned = phone.replace(/\D/g, "");
    navigator.clipboard.writeText(cleaned).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  const selectedMember = teamMembers.find((m) => m.id === selectedOwner);

  // Enrich data with call info
  const calledSet = new Set((calledNumbers || []).map((n) => normPhone(n)));
  const enrichedData = data.map((d) => {
    const phoneNorm = normPhone(d.phone);
    const isCalled = calledSet.has(phoneNorm);
    const callInfo = callDetails[phoneNorm] || null;
    return {
      ...d,
      called: isCalled,
      agentName: callInfo?.agentName || "",
      callStatus: callInfo?.status || "",
      callDuration: callInfo?.answeredSeconds || callInfo?.duration || 0,
      callTime: callInfo?.time || "",
    };
  });

  const totalCalled = enrichedData.filter((d) => d.called).length;
  const totalNotCalled = enrichedData.length - totalCalled;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Staff Delivery Report</h1>
          <span className="header-date">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        {searched && (
          <div className="header-stats">
            <span className="stat-pill blue">{data.length} Deliveries</span>
            <span className="stat-pill" style={{ background: "#d4edda", color: "#155724" }}>{totalCalled} Called</span>
            <span className="stat-pill" style={{ background: "#f8d7da", color: "#721c24" }}>{totalNotCalled} Not Called</span>
          </div>
        )}
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
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Staff Member</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
                minWidth: 200,
                background: "#fff",
              }}
            >
              <option value="">-- Select Staff --</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>

          <button
            className="section-refresh-btn leads"
            onClick={fetchReport}
            disabled={loading}
            style={{ height: 38 }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <SkeletonTable columns={9} rows={8} />
        ) : searched ? (
          data.length > 0 ? (
            <>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
                {selectedMember?.name || "Staff"} | {formatDate(startDate)} - {formatDate(endDate)} | {data.length} contacts
              </div>
              <table className="data-table team-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Last Delivery Date</th>
                    <th>Plan</th>
                    <th>Call Status</th>
                    <th>Agent</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedData.map((d, i) => (
                    <tr key={d.id || i} className={d.called ? "row-called" : ""}>
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
                      <td>{d.email || "-"}</td>
                      <td>{formatDate(d.lastDeliveryDate)}</td>
                      <td>{d.planName || "-"}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: d.called ? "#d4edda" : "#f8d7da",
                            color: d.called ? "#155724" : "#721c24",
                          }}
                        >
                          {d.called
                            ? getCallStatusLabel(d.callStatus)
                            : "Not Called"}
                        </span>
                      </td>
                      <td style={{ fontWeight: d.called ? 600 : 400 }}>
                        {d.called ? d.agentName || "-" : "-"}
                      </td>
                      <td>{d.called ? formatDuration(d.callDuration) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="no-data">No deliveries found for this filter</div>
          )
        ) : (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
            Staff select karo aur date range deke Search karo
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffReportPage;
