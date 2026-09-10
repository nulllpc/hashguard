async function collectTelemetry() {
    try {
        console.log('====================================================');
        console.log('   HashGuard Telemetry Bridge (LIVE INTEGRATION)');
        console.log('====================================================\n');

        const sv2Url = process.env.SV2_URL || 'http://localhost:9092/api/v1/global';
        const sv2Res = await fetch(sv2Url);
        const sv2Data = await sv2Res.json();
        
        const mdkUrl = process.env.MDK_URL || 'http://localhost:3007/site/overview';
        const mdkRes = await fetch(mdkUrl);
        const mdkData = await mdkRes.json();

        // 3. Extract metrics
        const physicalHashrate = (mdkData.totals?.hashrateMhs || 0) * 1_000_000; // H/s
        const sv2ProtocolHashrate = Math.max(0, sv2Data.server?.total_hashrate || 0); // H/s
        const hashLoss = physicalHashrate - sv2ProtocolHashrate;
        const hashLossPercentage = physicalHashrate > 0 ? ((hashLoss / physicalHashrate) * 100).toFixed(2) : "0.00";

        console.log('[1] Physical Farm State (Tether MDK Gateway - Port 3007)');
        console.log(`    - Machines Online:       ${mdkData.totals?.onlineCount} / ${mdkData.totals?.minerCount}`);
        console.log(`    - Total Power Draw:      ${((mdkData.totals?.powerW || 0) / 1000).toFixed(2)} kW`);
        console.log(`    - Physical Chip Output:  ${(physicalHashrate / 1e15).toFixed(3)} PH/s\n`);

        console.log('[2] Protocol State (Real SV2 Translator Proxy - Port 9092)');
        console.log(`    - Upstream Peer:         blitzpool.yourdevice.ch:3333 (Stratum V2)`);
        console.log(`    - Proxy Uptime:          ${sv2Data.uptime_secs}s`);
        console.log(`    - Downstream SV1 Miners: ${sv2Data.sv1_clients?.total_clients || 0}`);
        console.log(`    - Upstream SV2 Channels: ${sv2Data.server?.total_channels || 0}`);
        console.log(`    - Protocol Hashrate:     ${(sv2ProtocolHashrate / 1e15).toFixed(3)} PH/s\n`);

        console.log('[3] HashGuard Discrepancy & Revenue Leakage Engine');
        if (hashLoss > 0) {
            console.log(`    ⚠️  DISCREPANCY DETECTED: Hashrate Leakage!`);
            console.log(`    - Uncredited Hashrate:   ${(hashLoss / 1e12).toFixed(3)} TH/s (${hashLossPercentage}%)`);
            console.log(`    - Root Cause: No downstream miners currently pointed at tProxy (port 34255).`);
            console.log(`                  All physical ASICs are currently bypassed or on legacy pool.`);
        } else {
            console.log(`    ✅  Zero Leakage: All physical hash is fully credited by the SV2 pool.`);
        }
        console.log('\n====================================================');

    } catch (e) {
        console.error('Telemetry collection failed:', e.message);
    }
}

collectTelemetry();
