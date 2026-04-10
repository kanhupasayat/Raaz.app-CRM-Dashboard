


import React from "react";

function StatsCards({ totalDeliveries, totalLeads, totalContacts, totalUsers }) {
  return (
    <div className="stats-row">
      <div className="stat-card green">
        <div className="stat-value">{totalDeliveries}</div>
        <div className="stat-label">Total Orders Delivered</div>
      </div>
      <div className="stat-card blue">
        <div className="stat-value">{totalLeads}</div>
        <div className="stat-label">Today's Leads</div>
      </div>
      <div className="stat-card orange">
        <div className="stat-value">{totalContacts}</div>
        <div className="stat-label">Total Contacts</div>
      </div>
      <div className="stat-card purple">
        <div className="stat-value">{totalUsers}</div>
        <div className="stat-label">Team Members</div>
      </div>
    </div>
  );
}

export default StatsCards;
