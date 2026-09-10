import { MockMdkGateway } from './mock-mdk.mjs';
import { MockSv2Proxy } from './mock-sv2-proxy.mjs';

export class TestbedHarness {
  constructor(options = {}) {
    this.mdkPort = options.mdkPort || 3007;
    this.sv2Port = options.sv2Port || 9092;
    this.minerCount = options.minerCount || 30;

    this.mdk = new MockMdkGateway({
      port: this.mdkPort,
      minerCount: this.minerCount,
      ...options.mdkOptions,
    });

    this.sv2 = new MockSv2Proxy({
      port: this.sv2Port,
      ...options.sv2Options,
    });

    this.running = false;
    this._cleanupBound = this.stop.bind(this);
  }

  async start() {
    if (this.running) return;

    await this.mdk.start();
    await this.sv2.start();

    this.running = true;

    process.on('SIGINT', this._cleanupBound);
    process.on('SIGTERM', this._cleanupBound);
  }

  async stop() {
    if (!this.running) return;

    process.off('SIGINT', this._cleanupBound);
    process.off('SIGTERM', this._cleanupBound);

    await Promise.all([
      this.mdk.stop(),
      this.sv2.stop(),
    ]);

    this.running = false;
  }

  injectProxyLag(ms) {
    this.sv2.updateMetrics({ artificialLagMs: ms });
  }

  injectProxyCrash(simulatedCrash = true) {
    this.sv2.updateMetrics({ simulatedCrash });
  }

  setCohortStatus(containerId, status) {
    this.mdk.setCohortStatus(containerId, status);
  }

  async getStatus() {
    return {
      running: this.running,
      mdk: {
        port: this.mdkPort,
        overviewUrl: `http://127.0.0.1:${this.mdkPort}/site/overview`,
      },
      sv2: {
        port: this.sv2Port,
        globalUrl: `http://127.0.0.1:${this.sv2Port}/api/v1/global`,
      },
    };
  }
}
