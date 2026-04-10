import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = ["#2ec4b6", "#4361ee", "#ff6b35", "#7209b7", "#e63946", "#457b9d"];

function DeliveryTable({ deliveries, totalCount }) {
  const [showDetails, setShowDetails] = useState(false);

  // Group deliveries by courier
  const courierCount = {};
  deliveries.forEach((d) => {
    const courier = d.courier || "Unknown";
    courierCount[courier] = (courierCount[courier] || 0) + 1;
  });

  const chartData = Object.entries(courierCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Total revenue
  const totalRevenue = deliveries.reduce((sum, d) => sum + (d.invoiceValue || 0), 0);

  return (
    <div className="section">
      <h2>
        Proship Deliveries Today (Total: {totalCount})
        {totalRevenue > 0 && (
          <span style={{ fontSize: 14, fontWeight: 400, color: "#2ec4b6", marginLeft: 16 }}>
            Revenue: Rs.{totalRevenue.toLocaleString("en-IN")}
          </span>
        )}
      </h2>

      {deliveries.length > 0 ? (
        <>
          {/* Courier-wise bar chart */}
          {chartData.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
                Courier-wise Breakdown
              </h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Dropdown toggle for delivery details */}
          <button
            className="dropdown-toggle-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "▲ Hide" : "▼ View"} Delivery Details ({deliveries.length})
          </button>

          {/* Delivery details table - only show when dropdown is open */}
          {showDetails && (
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>AWB</th>
                  <th>Courier</th>
                  <th>City</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Delivered</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d, index) => (
                  <tr key={d.orderId || index}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.orderId || "-"}</td>
                    <td>{d.customerName || "-"}</td>
                    <td style={{ fontSize: 12 }}>{d.awb || "-"}</td>
                    <td>{d.courier || "-"}</td>
                    <td>{d.city || "-"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: d.paymentMode === "COD" ? "#fff3cd" : "#d4edda",
                          color: d.paymentMode === "COD" ? "#856404" : "#155724",
                        }}
                      >
                        {d.paymentMode || "-"}
                      </span>
                    </td>
                    <td>Rs.{(d.invoiceValue || 0).toLocaleString("en-IN")}</td>
                    <td>
                      {d.deliveryDate
                        ? new Date(d.deliveryDate).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p style={{ color: "#888", padding: 20, textAlign: "center" }}>
          No deliveries found for today
        </p>
      )}
    </div>
  );
}

export default DeliveryTable;
