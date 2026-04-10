import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import TeamPage from "./components/TeamPage";
import OnboardingPage from "./components/OnboardingPage";
import AssessmentPage from "./components/AssessmentPage";
import StaffReportPage from "./components/StaffReportPage";
import CsvCallReportPage from "./components/CsvCallReportPage";
import { CallProvider, useCallData } from "./CallContext";
import "./App.css";

// Get today's date in IST
function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Load excluded members from localStorage
function loadExcluded() {
  try {
    return JSON.parse(localStorage.getItem("excludedMembers")) || [];
  } catch {
    return [];
  }
}

// Load saved date from localStorage
function loadSavedDate() {
  return localStorage.getItem("savedContactsDate") || "";
}

function NavBar() {
  const location = useLocation();
  const links = [
    { path: "/", label: "Dashboard" },
    { path: "/team", label: "Team" },
    { path: "/onboarding", label: "Onboarding" },
    { path: "/assessment", label: "Assessment" },
    { path: "/staff-report", label: "Staff Report" },
    { path: "/csv-report", label: "CSV Report" },
  ];
  return (
    <nav className="nav-bar">
      {links.map((l) => (
        <Link
          key={l.path}
          to={l.path}
          className={`nav-link ${location.pathname === l.path ? "active" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

function AppContent() {
  const { calledNumbers, callDetails, totalCalls, fetchCalls } = useCallData();
  const [data, setData] = useState({
    users: [],
    leads: [],
    contacts: [],
    savedContacts: [],
    deliveryCount: 0,
    deliveries: [],
    loading: true,
  });
  const [excludedMembers, setExcludedMembers] = useState(loadExcluded);
  const [error, setError] = useState(null);
  const [refreshingLeads, setRefreshingLeads] = useState(false);
  const [refreshingContacts, setRefreshingContacts] = useState(false);
  const [refreshingProship, setRefreshingProship] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Save excluded members to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("excludedMembers", JSON.stringify(excludedMembers));
  }, [excludedMembers]);

  // Save contacts & call data to localStorage — TeamPage reads this for auto-refresh
  useEffect(() => {
    if (!data.loading) {
      localStorage.setItem("savedContacts", JSON.stringify(data.savedContacts));
      localStorage.setItem("calledNumbers", JSON.stringify(calledNumbers));
      localStorage.setItem("callDetails", JSON.stringify(callDetails));
    }
  }, [data.savedContacts, calledNumbers, callDetails, data.loading]);

  // Auto-clear: check if date changed, return empty if new day
  const getCleanSavedContacts = (prevSaved) => {
    const today = getTodayIST();
    const savedDate = loadSavedDate();
    if (savedDate && savedDate !== today) {
      // New day - clear old contacts
      localStorage.setItem("savedContactsDate", today);
      return [];
    }
    if (!savedDate) {
      localStorage.setItem("savedContactsDate", today);
    }
    return prevSaved;
  };

  // Merge new contacts with saved ones (no duplicates by phone)
  const mergeContacts = (existing, incoming) => {
    const cleaned = getCleanSavedContacts(existing);
    const phoneSet = new Set(cleaned.map((c) => c.Phone || ""));
    const newOnes = incoming.filter((c) => !phoneSet.has(c.Phone || ""));
    return [...cleaned, ...newOnes];
  };

  const fetchAllData = async () => {
    setData((prev) => ({ ...prev, loading: true }));
    setError(null);
    try {
      const [usersRes, leadsRes, contactsRes, deliveryRes] =
        await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL}/api/zoho/users`),
          fetch(`${process.env.REACT_APP_API_URL}/api/zoho/leads`),
          fetch(`${process.env.REACT_APP_API_URL}/api/zoho/contacts`),
          fetch(`${process.env.REACT_APP_API_URL}/api/proship/deliveries`),
        ]);

      // Call data fetch through shared context (parallel — don't block main data)
      fetchCalls().catch((err) => console.error("Call data fetch error:", err));

      const users = await usersRes.json();
      const leads = await leadsRes.json();
      const contacts = await contactsRes.json();
      const deliveries = await deliveryRes.json();

      const newContacts = contacts.data || [];

      setData((prev) => ({
        users: users.users || [],
        leads: leads.data || [],
        contacts: newContacts,
        savedContacts: mergeContacts(prev.savedContacts, newContacts),
        deliveryCount: deliveries.count || 0,
        deliveries: deliveries.deliveries || [],
        loading: false,
      }));
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Data fetch failed! Server se connection nahi ho paya.");
      setData((prev) => ({ ...prev, loading: false }));
    }
  };

  const fetchLeadsData = async () => {
    setRefreshingLeads(true);
    try {
      const [usersRes, leadsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/users`),
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/leads`),
      ]);

      const users = await usersRes.json();
      const leads = await leadsRes.json();

      setData((prev) => ({
        ...prev,
        users: users.users || [],
        leads: leads.data || [],
      }));
    } catch (err) {
      console.error("Error fetching Leads data:", err);
      setError("Leads fetch failed!");
    }
    setRefreshingLeads(false);
  };

  const fetchContactsData = async () => {
    setRefreshingContacts(true);
    try {
      const [contactsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/zoho/contacts`),
        fetchCalls(),
      ]);

      const contacts = await contactsRes.json();
      const newContacts = contacts.data || [];

      setData((prev) => ({
        ...prev,
        contacts: newContacts,
        savedContacts: mergeContacts(prev.savedContacts, newContacts),
      }));
    } catch (err) {
      console.error("Error fetching Contacts data:", err);
      setError("Contacts fetch failed!");
    }
    setRefreshingContacts(false);
  };

  const fetchProshipData = async () => {
    setRefreshingProship(true);
    try {
      const deliveryRes = await fetch(
        `${process.env.REACT_APP_API_URL}/api/proship/deliveries`
      );
      const deliveries = await deliveryRes.json();

      setData((prev) => ({
        ...prev,
        deliveryCount: deliveries.count || 0,
        deliveries: deliveries.deliveries || [],
      }));
    } catch (err) {
      console.error("Error fetching Proship data:", err);
      setError("Proship fetch failed!");
    }
    setRefreshingProship(false);
  };

  const clearContacts = () => {
    localStorage.setItem("savedContactsDate", getTodayIST());
    setData((prev) => ({
      ...prev,
      contacts: [],
      savedContacts: [],
    }));
  };

  const toggleExcludeMember = (memberName) => {
    setExcludedMembers((prev) =>
      prev.includes(memberName)
        ? prev.filter((n) => n !== memberName)
        : [...prev, memberName]
    );
  };

  // Filter contacts for team page - exclude selected members' contacts
  const teamContacts = data.savedContacts.filter(
    (c) => !excludedMembers.includes(c.Owner?.name || "")
  );

  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        {/* Dashboard - tumhara private page */}
        <Route
          path="/"
          element={
            <div className="app">
              <header className="app-header">
                <div className="header-left">
                  <h1>Raaz.app CRM Dashboard</h1>
                  <span className="header-date">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="header-buttons">
                  <button className="refresh-btn" onClick={fetchAllData}>
                    ↻ Refresh All
                  </button>
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
              {data.loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <Dashboard
                  data={{ ...data, calledNumbers, callDetails, totalCalls }}
                  onRefreshLeads={fetchLeadsData}
                  onRefreshContacts={fetchContactsData}
                  onRefreshProship={fetchProshipData}
                  onClearContacts={clearContacts}
                  excludedMembers={excludedMembers}
                  onToggleExclude={toggleExcludeMember}
                  refreshingLeads={refreshingLeads}
                  refreshingContacts={refreshingContacts}
                  refreshingProship={refreshingProship}
                />
              )}
            </div>
          }
        />

        {/* Team Page - team ke liye public page */}
        <Route
          path="/team"
          element={
            data.loading ? (
              <div className="app">
                <div className="loading">Loading...</div>
              </div>
            ) : (
              <TeamPage
                contacts={teamContacts}
                calledNumbers={calledNumbers}
                callDetails={callDetails}
              />
            )
          }
        />
        {/* Onboarding Page */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* Assessment Page */}
        <Route path="/assessment" element={<AssessmentPage />} />
        {/* Staff Report Page */}
        <Route path="/staff-report" element={<StaffReportPage />} />
        {/* CSV Call Report Page */}
        <Route path="/csv-report" element={<CsvCallReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <CallProvider>
      <AppContent />
    </CallProvider>
  );
}

export default App;
