import React from "react";
import StatsCards from "./StatsCards";
import LeadsTable from "./LeadsTable";
import ContactsTable from "./ContactsTable";
import CallStatus from "./CallStatus";
import TeamPerformance from "./TeamPerformance";
import DeliveryTable from "./DeliveryTable";

function Dashboard({
  data,
  onRefreshLeads,
  onRefreshContacts,
  onRefreshProship,
  onClearContacts,
  excludedMembers,
  onToggleExclude,
  refreshingLeads,
  refreshingContacts,
  refreshingProship,
}) {
  const { users, leads, savedContacts, deliveryCount, deliveries, calledNumbers, callDetails } = data;

  // Leads per person
  const leadsPerPerson = {};
  leads.forEach((lead) => {
    const owner = lead.Owner?.name || "Unassigned";
    leadsPerPerson[owner] = (leadsPerPerson[owner] || 0) + 1;
  });

  // Contacts per person
  const contactsPerPerson = {};
  savedContacts.forEach((contact) => {
    const owner = contact.Owner?.name || "Unassigned";
    contactsPerPerson[owner] = (contactsPerPerson[owner] || 0) + 1;
  });

  // Get unique owner names from contacts
  const ownerNames = [...new Set(savedContacts.map((c) => c.Owner?.name || "Unassigned"))].sort();

  return (
    <div className="dashboard">
      {/* Stats Cards */}
      <StatsCards
        totalLeads={leads.length}
        totalContacts={savedContacts.length}
        totalUsers={users.length}
        totalDeliveries={deliveryCount}
      />

      {/* Proship Delivery Section */}
      <div className="section-header-row">
        <h2 className="section-title">Proship Deliveries</h2>
        <button
          className="section-refresh-btn proship"
          onClick={onRefreshProship}
          disabled={refreshingProship}
        >
          {refreshingProship ? "Refreshing..." : "↻ Refresh Proship"}
        </button>
      </div>
      <DeliveryTable deliveries={deliveries} totalCount={deliveryCount} />

      {/* Leads Section */}
      <div className="section-header-row">
        <h2 className="section-title">Leads</h2>
        <button
          className="section-refresh-btn leads"
          onClick={onRefreshLeads}
          disabled={refreshingLeads}
        >
          {refreshingLeads ? "Refreshing..." : "↻ Refresh Leads"}
        </button>
      </div>
      <div className="grid-2">
        <LeadsTable leadsPerPerson={leadsPerPerson} />
        <CallStatus leads={leads} />
      </div>

      {/* Contacts Section */}
      <div className="section-header-row">
        <h2 className="section-title">Contacts</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="section-refresh-btn contacts"
            onClick={onRefreshContacts}
            disabled={refreshingContacts}
          >
            {refreshingContacts ? "Refreshing..." : "↻ Refresh Contacts"}
          </button>
          <button className="section-refresh-btn delete" onClick={onClearContacts}>
            Delete All
          </button>
        </div>
      </div>

      {/* Team Page Exclude Panel */}
      {ownerNames.length > 0 && (
        <div className="section exclude-panel">
          <h3 style={{ fontSize: 15, marginBottom: 10, color: "#1a1a2e" }}>
            Team Page - Exclude Members
            <span style={{ fontSize: 12, fontWeight: 400, color: "#888", marginLeft: 8 }}>
              (Selected members ke contacts /team page pe nahi dikhenge)
            </span>
          </h3>
          <div className="exclude-members-list">
            {ownerNames.map((name) => {
              const isExcluded = excludedMembers.includes(name);
              const count = contactsPerPerson[name] || 0;
              return (
                <button
                  key={name}
                  className={`exclude-member-btn ${isExcluded ? "excluded" : ""}`}
                  onClick={() => onToggleExclude(name)}
                >
                  {name} ({count})
                  {isExcluded && <span className="exclude-x"> ✕</span>}
                </button>
              );
            })}
          </div>
          {excludedMembers.length > 0 && (
            <p style={{ fontSize: 12, color: "#dc3545", marginTop: 8 }}>
              {excludedMembers.length} member(s) excluded from team page
            </p>
          )}
        </div>
      )}

      <ContactsTable
        contacts={savedContacts}
        calledNumbers={calledNumbers}
        callDetails={callDetails}
      />

      {/* Team Performance */}
      <TeamPerformance
        leadsPerPerson={leadsPerPerson}
        contactsPerPerson={contactsPerPerson}
      />
    </div>
  );
}

export default Dashboard;
