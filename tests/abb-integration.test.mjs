import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TestbedHarness } from '../testbed/harness.mjs';
import { runBenchmark } from '../abb/index.mjs';
import { formatCliReport, formatJsonReport, formatMarkdownReport } from '../abb/reporter.mjs';

describe('ABB End-to-End Integration', () => {
  let harness;

  afterEach(async () => {
    if (harness) await harness.stop();
  });

  test('runBenchmark executes cleanly against testbed and generates reports', async () => {
    harness = new TestbedHarness({ mdkPort: 3820, sv2Port: 9820, minerCount: 30 });
    await harness.start();

    const { comparison, financial } = await runBenchmark({
      mdkUrl: 'http://127.0.0.1:3820/site/overview',
      sv2Url: 'http://127.0.0.1:9820/api/v1/global',
      hashprice: 0.055,
      btcPrice: 65000,
    });

    // 1. Verify Cohort structures
    assert.equal(comparison.cohortA.minerCount, 15);
    assert.equal(comparison.cohortB.minerCount, 15);
    assert.ok(comparison.cohortA.physicalThs > 0);
    assert.ok(comparison.cohortB.physicalThs > 0);

    // 2. Verify stale rate reduction
    assert.ok(comparison.staleRateDelta > 0);
    assert.ok(comparison.recoveredThs > 0);

    // 3. Verify financial calculations
    assert.ok(financial.dailyUsd > 0);
    assert.ok(financial.monthlyUsd > financial.dailyUsd);
    assert.ok(financial.annualUsd > financial.monthlyUsd);
    assert.ok(financial.dailySats > 0);

    // 4. Verify report generation
    const cliOutput = formatCliReport(comparison, financial);
    assert.ok(cliOutput.includes('HASHGUARD A/B BENCHMARK REPORT'));
    assert.ok(cliOutput.includes('STRATUM V2 EFFICIENCY DELTA'));

    const jsonOutput = formatJsonReport(comparison, financial);
    assert.equal(typeof jsonOutput.timestamp, 'string');
    assert.equal(jsonOutput.comparison.recoveredThs, comparison.recoveredThs);

    const mdOutput = formatMarkdownReport(comparison, financial);
    assert.ok(mdOutput.includes('# HashGuard A/B Benchmark Report'));
    assert.ok(mdOutput.includes('## Financial Impact'));
  });
});
