import http from 'http';

const server = http.createServer((req, res) => {
  if (req.url === '/api/v1/global') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    // Mocking the structure derived from sv2-apps-fork's monitoring snapshot
    res.end(JSON.stringify({
      server_summary: {
        total_hashrate: 15000000000, // 15 TH/s
        extended_channels: 2,
        standard_channels: 500
      },
      sv1_clients_summary: {
        total_clients: 500,
        total_hashrate: 15030000000 // Slight mismatch (latency/stales)
      },
      // Added for the prototype to simulate channel metrics
      aggregated_metrics: {
        shares_accepted: 145000,
        shares_rejected: 120,
        shares_stale: 1450,
        shares_total: 146570,
        last_template_latency_ms: 180
      }
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 4444;
server.listen(PORT, () => {
  console.log(`[sv2-mock] Translation Proxy API running on http://localhost:${PORT}/api/v1/global`);
});
