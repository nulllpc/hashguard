import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockMdkGateway } from '../testbed/mock-mdk.mjs';
import { MockSv2Proxy } from '../testbed/mock-sv2-proxy.mjs';

describe('Testbed Mock Services', () => {
  let mdk;
  let sv2;

  afterEach(async () => {
    if (mdk) await mdk.stop();
    if (sv2) await sv2.stop();
  });

  test('MockMdkGateway serves overview and handles fleet control', async () => {
    mdk = new MockMdkGateway({ port: 3810, minerCount: 10 });
    await mdk.start();

    // 1. Initial overview
    const res = await fetch('http://127.0.0.1:3810/site/overview');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.totals.minerCount, 10);
    assert.equal(data.totals.onlineCount, 10);
    assert.equal(data.containers.length, 2);

    // 2. Set cohort status to offline
    const cohortRes = await fetch('http://127.0.0.1:3810/_control/cohort', {
      method: 'POST',
      body: JSON.stringify({ containerId: 'rack-1', status: 'offline' })
    });
    assert.equal(cohortRes.status, 200);

    const updatedRes = await fetch('http://127.0.0.1:3810/site/overview');
    const updatedData = await updatedRes.json();
    assert.equal(updatedData.totals.onlineCount, 5); // 5 offline in rack-1, 5 online in rack-2
  });

  test('MockSv2Proxy serves global API and supports fault injection', async () => {
    sv2 = new MockSv2Proxy({ port: 9810 });
    await sv2.start();

    // 1. Initial snapshot
    const res = await fetch('http://127.0.0.1:9810/api/v1/global');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.server.total_channels, 15);
    assert.ok(data.aggregated_metrics.shares_accepted > 0);

    // 2. Inject simulated crash
    await fetch('http://127.0.0.1:9810/_control/sv2', {
      method: 'POST',
      body: JSON.stringify({ simulatedCrash: true })
    });

    const crashedRes = await fetch('http://127.0.0.1:9810/api/v1/global');
    assert.equal(crashedRes.status, 503);

    // 3. Restore to healthy state
    await fetch('http://127.0.0.1:9810/_control/sv2', {
      method: 'POST',
      body: JSON.stringify({ simulatedCrash: false })
    });

    const restoredRes = await fetch('http://127.0.0.1:9810/api/v1/global');
    assert.equal(restoredRes.status, 200);
  });
});
