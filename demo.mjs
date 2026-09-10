import { TestbedHarness } from './testbed/harness.mjs';
import { runBenchmark } from './abb/index.mjs';
import { formatCliReport } from './abb/reporter.mjs';

async function runDemo() {
  console.log('\n==================================================================================');
  console.log('                 HASHGUARD: ZERO-RISK HASHRATE AUDITING APPLIANCE                 ');
  console.log('              Built on Tether MDK & Stratum V2 Protocol Telemetry                 ');
  console.log('==================================================================================\n');

  // Use isolated ports to guarantee zero collisions on any machine
  const mdkPort = 3888;
  const sv2Port = 9888;

  console.log('[1/4] Initializing Tier 1 Virtual Mining Testbed...');
  const harness = new TestbedHarness({
    mdkPort,
    sv2Port,
    minerCount: 30,
  });

  await harness.start();
  console.log(`      ✓ Mock Tether MDK Gateway active at http://127.0.0.1:${mdkPort}/site/overview`);
  console.log(`      ✓ Mock Stratum V2 Proxy API active at http://127.0.0.1:${sv2Port}/api/v1/global\n`);

  console.log('[2/4] Interrogating Physical Farm Telemetry (Tether MDK)...');
  const mdkRes = await fetch(`http://127.0.0.1:${mdkPort}/site/overview`);
  const mdkData = await mdkRes.json();
  console.log(`      • Active Fleet:     ${mdkData.totals.onlineCount} / ${mdkData.totals.minerCount} ASICs online`);
  console.log(`      • Total Power:      ${((mdkData.totals.powerW || 0) / 1000).toFixed(2)} kW`);
  console.log(`      • Nominal Hashrate: ${((mdkData.totals.hashrateMhs || 0) / 1e9).toFixed(3)} PH/s\n`);

  console.log('[3/4] Interrogating Protocol Telemetry (Stratum V2 Translation Proxy)...');
  const sv2Res = await fetch(`http://127.0.0.1:${sv2Port}/api/v1/global`);
  const sv2Data = await sv2Res.json();
  console.log(`      • Upstream Peer:    ${sv2Data.upstream?.address || 'blitzpool.yourdevice.ch:3333'}`);
  console.log(`      • Active Channels:  ${sv2Data.server.total_channels}`);
  console.log(`      • Accepted Shares:  ${sv2Data.aggregated_metrics.shares_accepted.toLocaleString()}`);
  console.log(`      • Stale Shares:     ${sv2Data.aggregated_metrics.shares_stale.toLocaleString()} (${((sv2Data.aggregated_metrics.shares_stale / sv2Data.aggregated_metrics.shares_total) * 100).toFixed(2)}%)\n`);

  console.log('[4/4] Executing A/B Benchmark (ABB) Engine...');
  console.log('      Comparing Rack 1 (SV1 Control) vs. Rack 2 (SV2 Test Batch)...\n');

  const { comparison, financial } = await runBenchmark({
    mdkUrl: `http://127.0.0.1:${mdkPort}/site/overview`,
    sv2Url: `http://127.0.0.1:${sv2Port}/api/v1/global`,
    hashprice: 0.055,
    btcPrice: 65000,
  });

  console.log(formatCliReport(comparison, financial));
  console.log('\n[✓] Demo completed successfully. Shutting down testbed cleanly...');
  await harness.stop();
  console.log('[✓] All testbed ports released.\n');
}

runDemo().catch(err => {
  console.error('\nDemo execution error:', err);
  process.exit(1);
});
