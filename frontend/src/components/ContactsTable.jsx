import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatDateTime(dateStr) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date)) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
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

// Call status label
function getCallStatusLabel(status) {
  if (!status) return "Called";
  if (status === "answered") return "Answered";
  if (status === "missed") return "Not Received";
  if (status === "failed") return "Failed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function ContactsTable({ contacts, calledNumbers, callDetails }) {
  const [selectedPerson, setSelectedPerson] = useState(null);

  const calledSet = new Set((calledNumbers || []).map((n) => normPhone(n)));
  const details = callDetails || {};

  // Group contacts by owner
  const grouped = {};
  contacts.forEach((c) => {
    const owner = c.Owner?.name || "Unassigned";
    if (!grouped[owner]) grouped[owner] = [];
    const apptTime = c.Appointment_Schedule || c.Created_Time || "";
    const phone = c.Phone || "";
    const phoneNorm = normPhone(phone);
    const isCalled = calledSet.has(phoneNorm);
    const callInfo = details[phoneNorm] || null;

    grouped[owner].push({
      name: c.Full_Name || "N/A",
      phone: phone || "N/A",
      slot: formatDateTime(c.Appointment_Schedule || ""),
      rawTime: apptTime,
      called: isCalled,
      agentName: callInfo?.agentName || "",
      callStatus: callInfo?.status || "",
      duration: callInfo?.duration || 0,
      answeredSeconds: callInfo?.answeredSeconds || 0,
      callTime: callInfo?.time || "",
    });
  });

  // Sort contacts by time within each group
  Object.keys(grouped).forEach((owner) => {
    grouped[owner].sort((a, b) => (a.rawTime || "").localeCompare(b.rawTime || ""));
  });

  // Chart data
  const chartData = Object.entries(grouped)
    .map(([name, list]) => ({ name, contacts: list.length }))
    .sort((a, b) => b.contacts - a.contacts);

  const totalContacts = contacts.length;
  const totalCalled = contacts.filter((c) => calledSet.has(normPhone(c.Phone))).length;
  const totalNotCalled = totalContacts - totalCalled;

  return (
    <div className="section">
      <h2>
        Today's Contacts ({totalContacts})
        <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 12 }}>
          <span style={{ color: "#155724" }}>Called: {totalCalled}</span>
          {" | "}
          <span style={{ color: "#721c24" }}>Not Called: {totalNotCalled}</span>
        </span>
      </h2>

      {chartData.length > 0 ? (
        <>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="contacts" fill="#2ec4b6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Person</th>
                <th>Contacts</th>
                <th>Called</th>
                <th>Not Called</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, index) => {
                const personContacts = grouped[item.name] || [];
                const calledCount = personContacts.filter((c) => c.called).length;
                const notCalledCount = personContacts.length - calledCount;
                return (
                  <tr key={item.name}>
                    <td>{index + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.contacts}</td>
                    <td>
                      <span className="badge" style={{ background: "#d4edda", color: "#155724" }}>
                        {calledCount}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: "#f8d7da", color: "#721c24" }}>
                        {notCalledCount}
                      </span>
                    </td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() =>
                          setSelectedPerson(selectedPerson === item.name ? null : item.name)
                        }
                      >
                        {selectedPerson === item.name ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Detail Table - selected person */}
          {selectedPerson && grouped[selectedPerson] && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>
                {selectedPerson} — {grouped[selectedPerson].length} Contacts
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Appointment</th>
                    <th>Call Status</th>
                    <th>Agent</th>
                    <th>Duration</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[selectedPerson].map((c, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{c.name}</td>
                      <td>{c.phone}</td>
                      <td>{c.slot}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: c.called ? "#d4edda" : "#f8d7da",
                            color: c.called ? "#155724" : "#721c24",
                          }}
                        >
                          {c.called ? "Called" : "Not Called"}
                        </span>
                      </td>
                      <td>{c.called ? c.agentName || "-" : "-"}</td>
                      <td>{c.called ? formatDuration(c.answeredSeconds || c.duration) : "-"}</td>
                      <td>
                        {c.called ? (
                          <span
                            className="badge"
                            style={{
                              background: c.callStatus === "answered" ? "#cce5ff" : "#fff3cd",
                              color: c.callStatus === "answered" ? "#004085" : "#856404",
                            }}
                          >
                            {getCallStatusLabel(c.callStatus)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p>No contacts found</p>
      )}
    </div>
  );
}

export default ContactsTable;
