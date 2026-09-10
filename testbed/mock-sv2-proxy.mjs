import http from 'http';

export class MockSv2Proxy {
  constructor(options = {}) {
    this.port = options.port || 9092;
    this.startTime = Date.now();
    this.server = null;

    this.simulatedCrash = false;
    this.artificialLagMs = 0;

    this.state = {
      upstream: {
        address: options.upstreamAddress || 'blitzpool.yourdevice.ch:3333',
        status: 'connected',
      },
      server: {
        total_channels: options.totalChannels ?? 15,
        total_hashrate: options.totalHashrate ?? 3_450_000_000_000_000, // 3.45 PH/s
        extended_channels: options.extendedChannels ?? 0,
        standard_channels: options.standardChannels ?? 15,
      },
      sv1_clients: {
        total_clients: options.totalClients ?? 15,
        total_hashrate: options.totalHashrate ?? 3_450_000_000_000_000,
      },
      aggregated_metrics: {
        shares_accepted: options.sharesAccepted ?? 50_000,
        shares_rejected: options.sharesRejected ?? 25,
        shares_stale: options.sharesStale ?? 120,
        shares_total: options.sharesTotal ?? 50_145,
        last_template_latency_ms: options.templateLatencyMs ?? 42,
      },
    };
  }

  getSnapshot() {
    const uptimeSecs = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      uptime_secs: uptimeSecs,
      upstream: this.state.upstream,
      server: this.state.server,
      server_summary: this.state.server,
      sv1_clients: this.state.sv1_clients,
      sv1_clients_summary: this.state.sv1_clients,
      aggregated_metrics: this.state.aggregated_metrics,
    };
  }

  updateMetrics(updates = {}) {
    if (updates.server) Object.assign(this.state.server, updates.server);
    if (updates.sv1_clients) Object.assign(this.state.sv1_clients, updates.sv1_clients);
    if (updates.aggregated_metrics) Object.assign(this.state.aggregated_metrics, updates.aggregated_metrics);
    if (updates.upstream) Object.assign(this.state.upstream, updates.upstream);
    if (updates.artificialLagMs !== undefined) this.artificialLagMs = updates.artificialLagMs;
    if (updates.simulatedCrash !== undefined) this.simulatedCrash = updates.simulatedCrash;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        // Control endpoints must bypass simulated crashes and lag so tests can control/restore state
        if (req.method === 'POST' && url.pathname === '/_control/sv2') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const updates = JSON.parse(body);
              this.updateMetrics(updates);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', snapshot: this.getSnapshot() }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (this.artificialLagMs > 0) {
          await new Promise(r => setTimeout(r, this.artificialLagMs));
        }

        if (this.simulatedCrash) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'tProxy daemon unavailable / crashed' }));
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/v1/global') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getSnapshot()));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.on('error', reject);
      this.server.listen(this.port, () => resolve());
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }
}

if (process.argv[1] && process.argv[1].endsWith('mock-sv2-proxy.mjs')) {
  const port = parseInt(process.env.SV2_PORT, 10) || 9092;
  const mock = new MockSv2Proxy({ port });
  mock.start().then(() => {
    console.log(`[mock-sv2-proxy] Listening on http://127.0.0.1:${port}/api/v1/global`);
  });
}
