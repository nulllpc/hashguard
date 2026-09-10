const { BaseWorker } = require('@tetherto/mdk-core')

class StratumV2Worker extends BaseWorker {
  constructor (config) {
    super(config)
    // The SV2 proxy endpoint we will pull data from
    this.proxyRpcEndpoint = config.rpcEndpoint || 'http://localhost:4444'
  }

  // The MDK Kernel calls this automatically based on the worker's refresh interval
  async collectTelemetry () {
    try {
      const res = await fetch(`${this.proxyRpcEndpoint}/api/v1/global`)
      if (!res.ok) throw new Error(`SV2 Proxy returned ${res.status}`)
      
      const sv2Data = await res.json()
      const metrics = sv2Data.aggregated_metrics || {}

      // MDK Protocol format mapping
      return {
        workerId: this.id,
        timestamp: Date.now(),
        metrics: {
          activeChannels: sv2Data.server_summary?.standard_channels || 0,
          acceptedShares: metrics.shares_accepted || 0,
          rejectedShares: metrics.shares_rejected || 0,
          staleRatio: (metrics.shares_stale || 0) / (metrics.shares_total || 1),
          templateLatencyMs: metrics.last_template_latency_ms || 0
        }
      }
    } catch (err) {
      // BaseWorker provides a built-in logger
      this.logger.error(`Failed to collect SV2 telemetry: ${err.message}`)
      throw err
    }
  }
}

module.exports = StratumV2Worker
