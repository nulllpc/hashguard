import http from 'http';

export class MockMdkGateway {
  constructor(options = {}) {
    this.port = options.port || 3007;
    this.minerCount = options.minerCount || 30;
    this.hashratePerMinerMhs = options.hashratePerMinerMhs || 230_000_000; // 230 TH/s
    this.powerPerMinerW = options.powerPerMinerW || 3300;
    this.server = null;

    this.state = this._buildInitialState();
  }

  _buildInitialState() {
    const miners = [];
    const half = Math.floor(this.minerCount / 2);

    for (let i = 1; i <= this.minerCount; i++) {
      const container = i <= half ? 'rack-1' : 'rack-2';
      miners.push({
        id: `miner-${String(i).padStart(3, '0')}`,
        container,
        ip: `192.168.1.${100 + i}`,
        status: 'online',
        hashrateMhs: this.hashratePerMinerMhs,
        powerW: this.powerPerMinerW,
      });
    }

    return {
      miners,
      containers: [
        { id: 'rack-1', label: 'Rack 1 (Cohort A - SV1 Control)', minerCount: half },
        { id: 'rack-2', label: 'Rack 2 (Cohort B - SV2 Test)', minerCount: this.minerCount - half },
      ]
    };
  }

  _computeTotals() {
    const onlineMiners = this.state.miners.filter(m => m.status === 'online');
    const hashrateMhs = onlineMiners.reduce((acc, m) => acc + m.hashrateMhs, 0);
    const powerW = onlineMiners.reduce((acc, m) => acc + m.powerW, 0);

    return {
      hashrateMhs,
      powerW,
      minerCount: this.state.miners.length,
      onlineCount: onlineMiners.length
    };
  }

  getOverview() {
    const totals = this._computeTotals();
    return {
      ts: Date.now(),
      containers: this.state.containers.map(c => ({
        ...c,
        powerW: this.state.miners
          .filter(m => m.container === c.id && m.status === 'online')
          .reduce((acc, m) => acc + m.powerW, 0),
        hashrateMhs: this.state.miners
          .filter(m => m.container === c.id && m.status === 'online')
          .reduce((acc, m) => acc + m.hashrateMhs, 0)
      })),
      site: {
        powerW: totals.powerW,
        tensionV: 400,
        currentA: totals.powerW > 0 ? totals.powerW / 400 : 0
      },
      miners: this.state.miners,
      totals
    };
  }

  updateMiner(id, updates) {
    const miner = this.state.miners.find(m => m.id === id);
    if (!miner) return null;
    Object.assign(miner, updates);
    return miner;
  }

  setCohortStatus(containerId, status) {
    for (const miner of this.state.miners) {
      if (miner.container === containerId) {
        miner.status = status;
      }
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        if (req.method === 'GET' && url.pathname === '/site/overview') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getOverview()));
          return;
        }

        if (req.method === 'POST' && url.pathname === '/_control/miner') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const updated = this.updateMiner(payload.id, payload.updates);
              if (!updated) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Miner not found' }));
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ miner: updated }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/_control/cohort') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { containerId, status } = JSON.parse(body);
              this.setCohortStatus(containerId, status);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', overview: this.getOverview() }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.on('error', reject);
      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }
}

if (process.argv[1] && process.argv[1].endsWith('mock-mdk.mjs')) {
  const port = parseInt(process.env.MDK_PORT, 10) || 3007;
  const mock = new MockMdkGateway({ port });
  mock.start().then(() => {
    console.log(`[mock-mdk] Gateway listening at http://127.0.0.1:${port}/site/overview`);
  });
}
