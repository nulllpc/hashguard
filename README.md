# HashGuard 🛡️

**Zero-Risk Hashrate Auditing & Stratum V2 Migration Appliance Built on Tether MDK**

HashGuard is a lightweight telemetry sidecar that bridges physical ASIC hardware metrics (via [Tether MDK](https://github.com/tetherto/mdk)) and cryptographic mining protocol telemetry (via the [Stratum V2 Reference Implementation](https://github.com/stratum-mining/stratum)).

It enables commercial mining farms to de-risk Stratum V2 migration by running side-by-side **A/B Benchmarks** on live racks, proving the dollar value of reduced stale shares and recovering hashrate leakage before committing full facilities.

---

## Architecture

```text
  [ Physical Farm Telemetry ]                   [ Cryptographic Protocol Telemetry ]
  Tether MDK Gateway (:3007)                    Stratum V2 Translation Proxy (:9092)
  • Per-rack nominal chip hashrate              • Aggregated accepted/rejected shares
  • Real-time power draw (kW)                   • Stale share propagation counters
  • Online/offline ASIC health                  • Active SV2 upstream channels
             │                                                 │
             └───────────────────────┬─────────────────────────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │      HASHGUARD ENGINE     │
                       ├───────────────────────────┤
                       │ • A/B Benchmark (ABB)     │
                       │ • Discrepancy Auditing    │
                       │ • Dollarization Engine    │
                       └─────────────┬─────────────┘
                                     │
                                     ▼
                       [ Executive CFO Reports ]
                       • CLI Comparison Matrix
                       • JSON Telemetry Stream
                       • Facility Audit Markdown
```

---

## ⚡ Quick Start (Zero Prerequisites)

The repository includes a self-contained **Tier 1 Virtual Mining Testbed** simulating a 30-ASIC farm and an SV2 Translation Proxy. You can run tests and live demos immediately with standard Node.js (>= 20) without compiling Rust or running Docker:

```bash
# 1. Run the automated test suite (8 unit & integration tests)
npm test

# 2. Run the full end-to-end demo (boots virtual testbed, runs ABB, prints CFO report)
npm run demo
```

### Sample Output (`npm run demo`):

```text
==================================================================================
                   HASHGUARD A/B BENCHMARK REPORT (EXECUTIVE)                     
==================================================================================
| Metric                   | Rack A (RACK-1 - SV1)    | Rack B (RACK-2 - SV2)    |
----------------------------------------------------------------------------------
| Protocol                 | SV1                      | SV2                      |
| Active Fleet             | 15 ASICs                 | 15 ASICs                 |
| Power Draw               | 49.50 kW                 | 49.50 kW                 |
| Physical Output          | 3.450 PH/s               | 3.450 PH/s               |
| Total Shares             | 50,145                   | 50,145                   |
| Accepted Shares          | 49,368                   | 50,000                   |
| Stale Shares             | 727 (1.45%)              | 120 (0.24%)              |
| Rejected Shares          | 50 (0.10%)               | 25 (0.05%)               |
| Delivery Efficiency      | 98.55%                   | 100.00%                  |
----------------------------------------------------------------------------------
  STRATUM V2 EFFICIENCY DELTA & GAINS:
    • Stale Rate Reduction:     -1.21% (83.5% drop in stales)
    • Net Recovered Hashrate:   +41.76 TH/s
----------------------------------------------------------------------------------
  FINANCIAL IMPACT (DOLLARIZATION):
    • Hashprice Baseline:       $0.055 / TH / day
    • Daily Recovered Revenue:  +$2.30 / day (+3,534 sats)
    • Monthly Recovered Revenue:+$69.91 / mo (+107,566 sats)
    • Annualized Facility Gain: +$838.37 / year (for tested cohort)
    • Annual Value per ASIC:    +$55.89 / ASIC / year
==================================================================================
```

---

## 🛠️ Project Structure

- **`abb/`**: The **A/B Benchmark Engine**:
  - `engine.mjs`: Pure math for stale rates, delivery efficiency, and hashprice dollarization.
  - `reporter.mjs`: Executive formatters (CLI terminal tables, JSON, and Markdown).
  - `index.mjs`: Live orchestrator querying MDK and proxy endpoints.
- **`testbed/`**: The **Tier 1 Virtual Mining Testbed**:
  - `mock-mdk.mjs`: Simulates Tether MDK Gateway (`:3007 /site/overview`) with configurable miner cohorts.
  - `mock-sv2-proxy.mjs`: Simulates SRI `translator_sv2` (`:9092 /api/v1/global`) with fault injection hooks (`lag`, `crash`, `restore`).
  - `harness.mjs`: Unified programmatic lifecycle manager.
  - `cli.mjs`: Interactive CLI runner (`npm run testbed:start`).
- **`tests/`**: Automated test suite using Node's native test runner (`node --test`):
  - `engine.test.mjs`: Unit tests for boundary safety (zero shares/hashrate without `NaN`/`Infinity`).
  - `testbed.test.mjs`: Testbed lifecycle and fault injection verification.
  - `abb-integration.test.mjs`: End-to-end integration test.
- **`bridge.mjs`**: Discrepancy auditing engine comparing physical chip output to pool-credited hashrate.
- **`sv2-worker/`**: Prototype Tether MDK Layer 1 Worker extending `@tetherto/mdk-core`'s `BaseWorker`.
- **`demo.mjs`**: 1-command standalone demonstration runner.

---

## 🌐 Live Protocol Verification (Stratum V2 + Blitzpool)

In addition to the virtual testbed, HashGuard has been verified against live Bitcoin mining protocol infrastructure:

```text
====================================================
   HashGuard Telemetry Bridge (LIVE INTEGRATION)
====================================================

[1] Physical Farm State (Tether MDK Gateway - Port 3007)
    - Machines Online:       30 / 30
    - Total Power Draw:      63.48 kW
    - Physical Chip Output:  6.916 PH/s

[2] Protocol State (Real SV2 Translator Proxy - Port 9092)
    - Upstream Peer:         blitzpool.yourdevice.ch:3333 (Stratum V2)
    - Proxy Uptime:          352s
    - Downstream SV1 Miners: 1
    - Upstream SV2 Channels: 1
    - Protocol Hashrate:     0.010 PH/s

[3] HashGuard Discrepancy & Revenue Leakage Engine
    ⚠️  DISCREPANCY DETECTED: Hashrate Leakage!
    - Uncredited Hashrate:   6905.905 TH/s (99.86%)
    - Root Cause: 29 physical ASICs not yet routed through tProxy.
====================================================
```

---

## 🧩 Tether MDK Integration Model

HashGuard is designed to operate natively within Tether's Mining Development Kit:

1. **Layer 1 Worker (`sv2-worker/`):** Connects to `translator_sv2` and registers the Stratum V2 Translation Proxy as a recognized device on the MDK Kernel over HRPC.
2. **Gateway Plugin (`mdk-plugin.json`):** Mounts directly into the MDK Gateway, exposing `/api/hashguard/benchmark` and `/api/hashguard/discrepancy` alongside standard site routes.
3. **Standalone Appliance:** For facilities not yet running MDK site-wide, HashGuard runs as an isolated Docker container with an embedded minimal MDK kernel to audit test batches without touching the rest of the facility.

---

## 📜 License

MIT
