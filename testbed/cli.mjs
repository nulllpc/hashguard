import { TestbedHarness } from './harness.mjs';

const command = process.argv[2] || 'start';

async function main() {
  const mdkPort = parseInt(process.env.MDK_PORT, 10) || 3007;
  const sv2Port = parseInt(process.env.SV2_PORT, 10) || 9092;

  if (command === 'start') {
    const harness = new TestbedHarness({ mdkPort, sv2Port });
    await harness.start();

    console.log('====================================================');
    console.log('       HashGuard Tier 1 Virtual Testbed Active       ');
    console.log('====================================================');
    console.log(`[MDK Gateway]    http://127.0.0.1:${mdkPort}/site/overview`);
    console.log(`[SV2 Proxy API]  http://127.0.0.1:${sv2Port}/api/v1/global`);
    console.log('\nPress Ctrl+C to stop.\n');

    const keepAlive = () => setTimeout(keepAlive, 10000);
    keepAlive();
    return;
  }

  if (command === 'status') {
    console.log('Checking Testbed status...');
    try {
      const mdkRes = await fetch(`http://127.0.0.1:${mdkPort}/site/overview`);
      const mdkData = await mdkRes.json();
      console.log(`✅ MDK Gateway online (${mdkData.totals.onlineCount}/${mdkData.totals.minerCount} miners)`);
    } catch (e) {
      console.log(`❌ MDK Gateway unreachable: ${e.message}`);
    }

    try {
      const sv2Res = await fetch(`http://127.0.0.1:${sv2Port}/api/v1/global`);
      const sv2Data = await sv2Res.json();
      console.log(`✅ SV2 Proxy online (${sv2Data.server.total_channels} channels, ${(sv2Data.server.total_hashrate / 1e12).toFixed(2)} TH/s)`);
    } catch (e) {
      console.log(`❌ SV2 Proxy unreachable: ${e.message}`);
    }
    return;
  }

  if (command === 'fault') {
    const faultType = process.argv[3];
    const faultArg = process.argv[4];

    if (faultType === 'lag') {
      const ms = parseInt(faultArg, 10) || 200;
      await fetch(`http://127.0.0.1:${sv2Port}/_control/sv2`, {
        method: 'POST',
        body: JSON.stringify({ artificialLagMs: ms })
      });
      console.log(`Injected ${ms}ms artificial lag into SV2 proxy`);
      return;
    }

    if (faultType === 'crash') {
      await fetch(`http://127.0.0.1:${sv2Port}/_control/sv2`, {
        method: 'POST',
        body: JSON.stringify({ simulatedCrash: true })
      });
      console.log('Injected simulated crash (HTTP 503) into SV2 proxy');
      return;
    }

    if (faultType === 'restore') {
      await fetch(`http://127.0.0.1:${sv2Port}/_control/sv2`, {
        method: 'POST',
        body: JSON.stringify({ simulatedCrash: false, artificialLagMs: 0 })
      });
      console.log('Restored SV2 proxy to normal state');
      return;
    }

    console.error(`Unknown fault type: ${faultType}. Use 'lag <ms>', 'crash', or 'restore'.`);
    process.exit(1);
  }

  console.error(`Unknown command: ${command}. Use 'start', 'status', or 'fault'.`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
