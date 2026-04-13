import React, { useState } from "react";

function PhoneLookupPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiCalls, setApiCalls] = useState(0);

  const handleSearch = async () => {
    const numbers = phoneInput
      .split(/[\n,]+/)
      .map((n) => n.trim().replace(/\D/g, ""))
      .filter((n) => n.length >= 10);

    if (numbers.length === 0) return;

    setLoading(true);
    setResults([]);
    let totalCalls = 0;
    const allResults = [];

    for (const phone of numbers) {
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/api/zoho/deals-by-phone?phone=${phone}`
        );
        const data = await res.json();
        totalCalls += data.apiCalls || 0;

        if (data.totalDeals === 1) {
          const d = data.deals[0];
          allResults.push({
            phone,
            totalDeals: 1,
            status: "single",
            Contact_Name: d.Contact_Name,
            Stage: d.Stage,
            Onboarding_Call_Done: d.Onboarding_Call_Done,
            Onboarding_Date: d.Onboarding_Date,
            Medicine_Start_date: d.Medicine_Start_date,
            Followup_Date: d.Followup_Date,
          });
        } else if (data.totalDeals > 1) {
          allResults.push({
            phone,
            totalDeals: data.totalDeals,
            status: "multiple",
          });
        } else {
          allResults.push({ phone, totalDeals: 0, status: "not_found" });
        }
      } catch {
        allResults.push({ phone, totalDeals: 0, status: "error" });
      }
      setResults([...allResults]);
      setApiCalls(totalCalls);
    }

    setLoading(false);
  };

  const downloadCSV = () => {
    const headers = [
      "Phone",
      "Total Deals",
      "Status",
      "Contact Name",
      "Stage",
      "Onboarding Call Done",
      "Onboarding Date",
      "Medicine Start Date",
      "Followup Date",
    ];
    const rows = results.map((r) => [
      r.phone,
      r.totalDeals,
      r.status === "single"
        ? "1 Deal"
        : r.status === "multiple"
        ? `${r.totalDeals} Deals (skipped)`
        : "Not Found",
      r.Contact_Name || "",
      r.Stage || "",
      r.Onboarding_Call_Done || "",
      r.Onboarding_Date || "",
      r.Medicine_Start_date || "",
      r.Followup_Date || "",
    ]);

    const csv =
      [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phone_lookup_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "16px" }}>Phone Lookup</h2>

      <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
        <textarea
          placeholder="Phone numbers enter karo (ek per line ya comma se)&#10;e.g.&#10;8795881162&#10;8140793560&#10;9156542309"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          rows={6}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "14px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            resize: "vertical",
            fontFamily: "monospace",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={handleSearch}
            disabled={loading || !phoneInput.trim()}
            style={{
              padding: "12px 24px",
              background: loading ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
          {results.length > 0 && (
            <button
              onClick={downloadCSV}
              style={{
                padding: "12px 24px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Download CSV
            </button>
          )}
        </div>
      </div>

      {apiCalls > 0 && (
        <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "12px" }}>
          Total Zoho API Calls: <strong>{apiCalls}</strong>
        </p>
      )}

      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={th}>#</th>
                <th style={th}>Phone</th>
                <th style={th}>Deals</th>
                <th style={th}>Contact</th>
                <th style={th}>Stage</th>
                <th style={th}>Onboarding Call</th>
                <th style={th}>Onboarding Date</th>
                <th style={th}>Medicine Start</th>
                <th style={th}>Followup Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    background:
                      r.status === "not_found" || r.status === "error"
                        ? "#fef2f2"
                        : r.status === "multiple"
                        ? "#fffbeb"
                        : "#f0fdf4",
                  }}
                >
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{r.phone}</td>
                  <td style={td}>
                    <strong>{r.totalDeals}</strong>
                    {r.status === "multiple" && (
                      <span style={{ color: "#d97706", fontSize: "11px" }}>
                        {" "}(skipped)
                      </span>
                    )}
                  </td>
                  {r.status === "single" ? (
                    <>
                      <td style={td}>{r.Contact_Name}</td>
                      <td style={td}>{r.Stage}</td>
                      <td style={td}>{r.Onboarding_Call_Done}</td>
                      <td style={td}>{formatDate(r.Onboarding_Date)}</td>
                      <td style={td}>{formatDate(r.Medicine_Start_date)}</td>
                      <td style={td}>{formatDate(r.Followup_Date)}</td>
                    </>
                  ) : (
                    <td style={td} colSpan={6}>
                      {r.status === "multiple"
                        ? `${r.totalDeals} deals found — skipped`
                        : r.status === "error"
                        ? "Error"
                        : "No deal found"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = {
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: "2px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const td = {
  padding: "8px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

function formatDate(val) {
  if (!val || val === "nil") return "nil";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default PhoneLookupPage;
