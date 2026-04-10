import React from "react";

function SkeletonTable({ columns = 6, rows = 8 }) {
  return (
    <table className="data-table team-table skeleton-table">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <div className="skeleton-box skeleton-th" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c}>
                <div
                  className="skeleton-box"
                  style={{ width: `${60 + ((c * 7 + r * 3) % 35)}%` }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonStatsCards({ count = 4 }) {
  return (
    <div className="skeleton-stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-stat-card">
          <div className="skeleton-box" style={{ width: "50%", height: 14 }} />
          <div className="skeleton-box" style={{ width: "70%", height: 28, marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

export default SkeletonTable;
