import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function LeadsTable({ leadsPerPerson }) {
  const chartData = Object.entries(leadsPerPerson).map(([name, count]) => ({
    name,
    leads: count,
  }));

  return (
    <div className="section">
      <h2>Leads Assigned Per Person (Today)</h2>

      {chartData.length > 0 ? (
        <>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#4361ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Person</th>
                <th>Leads Assigned</th>
              </tr>
            </thead>
            <tbody>
              {chartData
                .sort((a, b) => b.leads - a.leads)
                .map((item, index) => (
                  <tr key={item.name}>
                    <td>{index + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.leads}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No leads found for today</p>
      )}
    </div>
  );
}

export default LeadsTable;
