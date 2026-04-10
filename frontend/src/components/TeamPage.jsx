import React, { useState, useEffect } from "react";

// Normalize phone to last 10 digits
function normPhone(phone) {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

// Get hours and minutes from Appointment_Schedule
function getAppointmentTime(schedule) {
  if (!schedule) return { hour: -1, minute: 0 };
  const date = new Date(schedule);
  if (isNaN(date)) return { hour: -1, minute: 0 };
  return { hour: date.getHours(), minute: date.getMinutes() };
}

// Format appointment time
function formatTime(schedule) {
  if (!schedule) return "-";
  const date = new Date(schedule);
  if (isNaN(date)) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format duration
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function TeamPage({ contacts: initialContacts, calledNumbers: initialCalled, callDetails: initialDetails }) {
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("09:00");
  const [customTo, setCustomTo] = useState("10:00");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [liveContacts, setLiveContacts] = useState(initialContacts);
  const [liveCalled, setLiveCalled] = useState(initialCalled);
  const [liveDetails, setLiveDetails] = useState(initialDetails);

  // Auto-refresh from localStorage every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const excluded = JSON.parse(localStorage.getItem("excludedMembers")) || [];
        const saved = JSON.parse(localStorage.getItem("savedContacts")) || [];
        const called = JSON.parse(localStorage.getItem("calledNumbers")) || [];
        const details = JSON.parse(localStorage.getItem("callDetails")) || {};
        const filtered = saved.filter((c) => !excluded.includes(c.Owner?.name || ""));
        setLiveContacts(filtered);
        setLiveCalled(called);
        setLiveDetails(details);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Also update when props change
  useEffect(() => {
    setLiveContacts(initialContacts);
    setLiveCalled(initialCalled);
    setLiveDetails(initialDetails);
  }, [initialContacts, initialCalled, initialDetails]);

  const calledSet = new Set((liveCalled || []).map((n) => normPhone(n)));
  const details = liveDetails || {};

  // Build contact list with call info
  let contactList = (liveContacts || []).map((c) => {
    const phoneNorm = normPhone(c.Phone);
    const isCalled = calledSet.has(phoneNorm);
    const callInfo = details[phoneNorm] || null;

    return {
      name: c.Full_Name || "N/A",
      phone: c.Phone || "",
      owner: c.Owner?.name || "Unassigned",
      appointment: c.Appointment_Schedule || "",
      appointmentTime: getAppointmentTime(c.Appointment_Schedule),
      called: isCalled,
      agentName: callInfo?.agentName || "",
      callStatus: callInfo?.status || "",
      duration: callInfo?.answeredSeconds || callInfo?.duration || 0,
    };
  });

  // Sort by appointment time
  contactList.sort((a, b) => (a.appointment || "").localeCompare(b.appointment || ""));

  // Time filter
  if (timeFilter !== "all") {
    contactList = contactList.filter((c) => {
      const { hour } = c.appointmentTime;
      if (timeFilter === "morning") return hour >= 9 && hour < 12;
      if (timeFilter === "afternoon") return hour >= 12 && hour < 15;
      if (timeFilter === "evening") return hour >= 15 && hour < 18;
      if (timeFilter === "custom") {
        const [fromH, fromM] = customFrom.split(":").map(Number);
        const [toH, toM] = customTo.split(":").map(Number);
        const fromMin = fromH * 60 + fromM;
        const toMin = toH * 60 + toM;
        const contactMin = c.appointmentTime.hour * 60 + c.appointmentTime.minute;
        return contactMin >= fromMin && contactMin < toMin;
      }
      return true;
    });
  }

  // Search filter
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    contactList = contactList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.owner.toLowerCase().includes(q)
    );
  }

  // Copy phone number
  const copyPhone = (phone, index) => {
    const cleaned = phone.replace(/\D/g, "");
    navigator.clipboard.writeText(cleaned).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  const totalCalled = contactList.filter((c) => c.called).length;
  const totalNotCalled = contactList.length - totalCalled;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Team - Today's Contacts</h1>
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
          <span className="stat-pill green">{totalCalled} Called</span>
          <span className="stat-pill red">{totalNotCalled} Not Called</span>
          <span className="stat-pill blue">{contactList.length} Total</span>
        </div>
      </header>

      <div className="team-page">
        {/* Filters */}
        <div className="team-filters">
          <input
            type="text"
            className="team-search"
            placeholder="Search name, phone, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="time-filter-btns">
            {[
              { key: "all", label: "All" },
              { key: "morning", label: "Morning (9-12)" },
              { key: "afternoon", label: "Afternoon (12-3)" },
              { key: "evening", label: "Evening (3-6)" },
              { key: "custom", label: "Custom" },
            ].map((f) => (
              <button
                key={f.key}
                className={`time-filter-btn ${timeFilter === f.key ? "active" : ""}`}
                onClick={() => setTimeFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            {timeFilter === "custom" && (
              <div className="custom-time-inputs">
                <input
                  type="time"
                  className="time-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span style={{ color: "#555", fontWeight: 600 }}>to</span>
                <input
                  type="time"
                  className="time-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Contacts Table */}
        {contactList.length > 0 ? (
          <table className="data-table team-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Time</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Agent</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {contactList.map((c, i) => (
                <tr key={i} className={c.called ? "row-called" : ""}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>
                    <div className="phone-cell">
                      <span>{c.phone}</span>
                      <button
                        className={`copy-btn ${copiedIndex === i ? "copied" : ""}`}
                        onClick={() => copyPhone(c.phone, i)}
                      >
                        {copiedIndex === i ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td>{formatTime(c.appointment)}</td>
                  <td>{c.owner}</td>
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
                  <td>{c.called ? formatDuration(c.duration) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No contacts found</div>
        )}
      </div>
    </div>
  );
}

export default TeamPage;
