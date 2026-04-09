export default function ModerationPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Moderasyon</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>
        Raporlar ve anlasmazliklar <code>admin-service</code> uzerinden API ile yonetilir (ornek:{" "}
        <code>GET /api/v1/admin/reports</code> — <code>x-admin-key</code> gerekli).
      </p>
      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: 8 }}>ID</th>
            <th style={{ padding: 8 }}>Tur</th>
            <th style={{ padding: 8 }}>Icerik</th>
            <th style={{ padding: 8 }}>Durum</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8 }}>rep_1</td>
            <td style={{ padding: 8 }}>listing</td>
            <td style={{ padding: 8 }}>lst_demo</td>
            <td style={{ padding: 8 }}>pending</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
