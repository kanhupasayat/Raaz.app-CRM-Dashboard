import React, { useState, useEffect } from "react";

function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m 0s";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec}s`;
}

function CsvCallReportPage() {
  const [numbers, setNumbers] = useState([]);
  const [fileName, setFileName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const today = getTodayIST();
    const weekAgo = new Date(new Date(today).getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    setFromDate(weekAgo);
    setToDate(today);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      // Parse CSV — extract all phone numbers (split by newline, comma, tab)
      const raw = text.split(/[\r\n,\t;]+/).map((s) => s.trim()).filter(Boolean);
      // Extract only strings that look like phone numbers (at least 10 digits after cleanup)
      const phones = raw
        .map((s) => s.replace(/[^0-9+]/g, "").replace(/^\+/, ""))
        .filter((s) => s.replace(/\D/g, "").length >= 10);
      setNumbers(phones);
    };
    reader.readAsText(file);
  };

  const fetchReport = async () => {
    if (!numbers.length) {
      setError("Pehle CSV file upload karo!");
      return;
    }
    if (!fromDate || !toDate) {
      setError("Date range select karo!");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tatatele/csv-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numbers, fromDate, toDate }),
        }
      );
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        setData([]);
      } else {
        setData(result.data || []);
      }
    } catch (err) {
      console.error("CSV report error:", err);
      setError("Data fetch failed! Server check karo.");
      setData([]);
    }
    setLoading(false);
  };

  // Filter data by search
  const filteredData = data.filter((d) =>
    !search || d.phone.includes(search.replace(/\D/g, ""))
  );

  // Summary stats
  const totalCalls = filteredData.reduce((s, d) => s + d.totalCalls, 0);
  const totalAnswered = filteredData.reduce((s, d) => s + d.answered, 0);
  const totalSeconds = filteredData.reduce((s, d) => s + d.totalSeconds, 0);
  const numbersWithCalls = filteredData.filter((d) => d.totalCalls > 0).length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>CSV Call Report</h1>
          <span className="header-date">
            CSV numbers pe Tata Tele outgoing call data
          </span>
        </div>
        {searched && data.length > 0 && (
          <div className="header-stats">
            <span className="stat-pill blue">{data.length} Numbers</span>
            <span className="stat-pill" style={{ background: "#d4edda", color: "#155724" }}>
              {totalCalls} Calls
            </span>
            <span className="stat-pill" style={{ background: "#fff3cd", color: "#856404" }}>
              {totalAnswered} Answered
            </span>
            <span className="stat-pill" style={{ background: "#e2e3f1", color: "#383d6e" }}>
              {formatDuration(totalSeconds)}
            </span>
          </div>
        )}
      </header>

      {error && (
        <div
          style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "12px 24px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 16,
              background: "none",
              border: "1px solid #721c24",
              color: "#721c24",
              borderRadius: 4,
              padding: "2px 10px",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="team-page">
        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 20,
          }}
        >
          {/* CSV Upload */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>
              CSV File (Phone Numbers)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  fontSize: 14,
                  background: "#fff",
                  cursor: "pointer",
                  display: "inline-block",
                }}
              >
                {fileName || "Choose File"}
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
              {numbers.length > 0 && (
                <span style={{ fontSize: 13, color: "#155724", fontWeight: 600 }}>
                  {numbers.length} numbers loaded
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
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

        {/* Search within results */}
        {searched && data.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #ddd",
                fontSize: 14,
                width: 250,
              }}
            />
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="loading">Loading... Tata Tele se data fetch ho raha hai</div>
        ) : searched ? (
          data.length > 0 ? (
            <>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
                {fromDate} to {toDate} | {numbersWithCalls}/{filteredData.length} numbers pe calls mili
              </div>
              <table className="data-table team-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Phone Number</th>
                    <th>Total Calls</th>
                    <th>Answered</th>
                    <th>Not Answered</th>
                    <th>Talk Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((d, i) => (
                    <tr
                      key={d.phone}
                      style={{
                        background:
                          d.totalCalls > 0
                            ? d.answered > 0
                              ? "#f0fff4"
                              : "#fffbf0"
                            : "#fff5f5",
                      }}
                    >
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{d.phone}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: d.totalCalls > 0 ? "#2563eb" : "#999",
                          }}
                        >
                          {d.totalCalls}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: d.answered > 0 ? "#d4edda" : "#f0f0f0",
                            color: d.answered > 0 ? "#155724" : "#999",
                          }}
                        >
                          {d.answered}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: d.totalCalls - d.answered > 0 ? "#f8d7da" : "#f0f0f0",
                            color: d.totalCalls - d.answered > 0 ? "#721c24" : "#999",
                          }}
                        >
                          {d.totalCalls - d.answered}
                        </span>
                      </td>
                      <td style={{ fontWeight: d.totalSeconds > 0 ? 600 : 400 }}>
                        {d.totalSeconds > 0 ? formatDuration(d.totalSeconds) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary row */}
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 20px",
                  background: "#f8f9fa",
                  borderRadius: 8,
                  display: "flex",
                  gap: 24,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <span>Total Numbers: {filteredData.length}</span>
                <span style={{ color: "#2563eb" }}>Total Calls: {totalCalls}</span>
                <span style={{ color: "#155724" }}>Answered: {totalAnswered}</span>
                <span style={{ color: "#721c24" }}>
                  Not Answered: {totalCalls - totalAnswered}
                </span>
                <span style={{ color: "#383d6e" }}>Total Talk Time: {formatDuration(totalSeconds)}</span>
              </div>
            </>
          ) : (
            <div className="no-data">Koi call data nahi mila</div>
          )
        ) : (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
            CSV file upload karo, date range do, aur Search karo
          </div>
        )}
      </div>
    </div>
  );
}

export default CsvCallReportPage;
