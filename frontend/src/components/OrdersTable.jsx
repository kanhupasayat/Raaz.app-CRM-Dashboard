import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function OrdersTable({ ordersPerPerson }) {
  const chartData = Object.entries(ordersPerPerson).map(([name, count]) => ({
    name,
    orders: count,
  }));

  const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);

  return (
    <div className="section">
      <h2>Orders Delivered Per Person (Total: {totalOrders})</h2>

      {chartData.length > 0 ? (
        <>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#ff6b35" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Person</th>
                <th>Orders Delivered</th>
              </tr>
            </thead>
            <tbody>
              {chartData
                .sort((a, b) => b.orders - a.orders)
                .map((item, index) => (
                  <tr key={item.name}>
                    <td>{index + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.orders}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>No delivered orders found</p>
      )}
    </div>
  );
}

export default OrdersTable;
