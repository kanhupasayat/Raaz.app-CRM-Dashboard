import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function TeamPerformance({ leadsPerPerson, contactsPerPerson }) {
  // Combine all data per person
  const allNames = new Set([
    ...Object.keys(leadsPerPerson),
    ...Object.keys(contactsPerPerson),
  ]);

  const chartData = Array.from(allNames).map((name) => ({
    name,
    leads: leadsPerPerson[name] || 0,
    contacts: contactsPerPerson[name] || 0,
  }));

  // Sort by total performance (leads + contacts)
  chartData.sort(
    (a, b) =>
      b.leads + b.contacts - (a.leads + a.contacts)
  );

  return (
    <div className="section">
      <h2>Team Performance Overview</h2>

      {chartData.length > 0 ? (
        <>
          <div className="chart-container" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="leads"
                  fill="#4361ee"
                  name="Leads"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="contacts"
                  fill="#2ec4b6"
                  name="Contacts"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Person</th>
                <th>Leads</th>
                <th>Contacts</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, index) => (
                <tr key={item.name}>
                  <td>{index + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.leads}</td>
                  <td>{item.contacts}</td>
                  <td>
                    <strong>
                      {item.leads + item.contacts}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No team data found</p>
      )}
    </div>
  );
}

export default TeamPerformance;
