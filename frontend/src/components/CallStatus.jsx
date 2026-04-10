import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#2ec4b6", "#e63946", "#4361ee", "#ff6b35", "#7209b7"];

const STATUS_LABELS = {
  Called: "badge-called",
  "Not Called": "badge-not-called",
  Interested: "badge-interested",
  "Not Interested": "badge-not-interested",
  "Follow Up": "badge-follow-up",
};

function CallStatus({ leads }) {
  // Group leads by their call/lead status
  const statusCount = {};
  leads.forEach((lead) => {
    const status = lead.Lead_Status || "Not Called";
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  const chartData = Object.entries(statusCount).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="section">
      <h2>Call Status Tracking</h2>

      {chartData.length > 0 ? (
        <>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, index) => (
                <tr key={item.name}>
                  <td>{index + 1}</td>
                  <td>
                    <span
                      className={`badge ${
                        STATUS_LABELS[item.name] || "badge-not-called"
                      }`}
                    >
                      {item.name}
                    </span>
                  </td>
                  <td>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No call status data found</p>
      )}
    </div>
  );
}

export default CallStatus;
