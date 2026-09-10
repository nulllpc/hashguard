function pad(str, len, align = 'left') {
  const s = String(str);
  if (s.length >= len) return s;
  const padding = ' '.repeat(len - s.length);
  return align === 'right' ? padding + s : s + padding;
}

function fmtPercent(val) {
  return (val * 100).toFixed(2) + '%';
}

function fmtPh(hps) {
  return (hps / 1e15).toFixed(3) + ' PH/s';
}

function fmtTh(ths) {
  return ths.toFixed(2) + ' TH/s';
}

function fmtKw(watts) {
  return (watts / 1000).toFixed(2) + ' kW';
}

function fmtUsd(val) {
  return '$' + val.toFixed(2);
}

export function formatCliReport(comparison, financial) {
  const a = comparison.cohortA;
  const b = comparison.cohortB;

  const colWidths = [24, 24, 24];
  const row = (col1, col2, col3) =>
    `| ${pad(col1, colWidths[0])} | ${pad(col2, colWidths[1])} | ${pad(col3, colWidths[2])} |`;
  const sep = '-' + '-'.repeat(colWidths[0] + colWidths[1] + colWidths[2] + 8) + '-';

  const lines = [
    '==================================================================================',
    '                   HASHGUARD A/B BENCHMARK REPORT (EXECUTIVE)                     ',
    '==================================================================================',
    row('Metric', a.label, b.label),
    sep,
    row('Protocol', a.protocol.toUpperCase(), b.protocol.toUpperCase()),
    row('Active Fleet', `${a.minerCount} ASICs`, `${b.minerCount} ASICs`),
    row('Power Draw', fmtKw(a.powerW), fmtKw(b.powerW)),
    row('Physical Output', fmtPh(a.physicalHashrateHps), fmtPh(b.physicalHashrateHps)),
    row('Total Shares', a.sharesTotal.toLocaleString(), b.sharesTotal.toLocaleString()),
    row('Accepted Shares', a.sharesAccepted.toLocaleString(), b.sharesAccepted.toLocaleString()),
    row('Stale Shares', `${a.sharesStale.toLocaleString()} (${fmtPercent(a.staleRate)})`, `${b.sharesStale.toLocaleString()} (${fmtPercent(b.staleRate)})`),
    row('Rejected Shares', `${a.sharesRejected.toLocaleString()} (${fmtPercent(a.rejectionRate)})`, `${b.sharesRejected.toLocaleString()} (${fmtPercent(b.rejectionRate)})`),
    row('Delivery Efficiency', fmtPercent(a.efficiency), fmtPercent(b.efficiency)),
    sep,
    '  STRATUM V2 EFFICIENCY DELTA & GAINS:',
    `    • Stale Rate Reduction:     ${(comparison.staleRateDelta > 0 ? '-' : '+') + fmtPercent(Math.abs(comparison.staleRateDelta))} (${comparison.staleReductionPercentage.toFixed(1)}% drop in stales)`,
    `    • Net Recovered Hashrate:   +${fmtTh(comparison.recoveredThs)}`,
    sep,
    '  FINANCIAL IMPACT (DOLLARIZATION):',
    `    • Hashprice Baseline:       $${financial.hashpriceUsdPerThDay.toFixed(3)} / TH / day`,
    `    • Daily Recovered Revenue:  +${fmtUsd(financial.dailyUsd)} / day` + (financial.dailySats ? ` (+${financial.dailySats.toLocaleString()} sats)` : ''),
    `    • Monthly Recovered Revenue:+${fmtUsd(financial.monthlyUsd)} / mo` + (financial.monthlySats ? ` (+${financial.monthlySats.toLocaleString()} sats)` : ''),
    `    • Annualized Facility Gain: +${fmtUsd(financial.annualUsd)} / year (for tested cohort)`,
    `    • Annual Value per ASIC:    +${fmtUsd(financial.annualPerMinerUsd)} / ASIC / year`,
    '==================================================================================',
  ];

  return lines.join('\n');
}

export function formatJsonReport(comparison, financial) {
  return {
    timestamp: new Date().toISOString(),
    cohortA: comparison.cohortA,
    cohortB: comparison.cohortB,
    comparison: {
      staleRateDelta: comparison.staleRateDelta,
      staleReductionPercentage: comparison.staleReductionPercentage,
      efficiencyDelta: comparison.efficiencyDelta,
      recoveredThs: comparison.recoveredThs,
    },
    financial,
  };
}

export function formatMarkdownReport(comparison, financial) {
  const a = comparison.cohortA;
  const b = comparison.cohortB;

  return `# HashGuard A/B Benchmark Report

**Generated:** ${new Date().toISOString()}  
**Hashprice Baseline:** $${financial.hashpriceUsdPerThDay.toFixed(3)} / TH / day  

## Cohort Comparison

| Metric | ${a.label} | ${b.label} | Delta |
| :--- | :--- | :--- | :--- |
| **Protocol** | ${a.protocol.toUpperCase()} | ${b.protocol.toUpperCase()} | — |
| **Active ASICs** | ${a.minerCount} | ${b.minerCount} | — |
| **Power Consumption** | ${fmtKw(a.powerW)} | ${fmtKw(b.powerW)} | — |
| **Physical Hashrate** | ${fmtPh(a.physicalHashrateHps)} | ${fmtPh(b.physicalHashrateHps)} | — |
| **Total Shares** | ${a.sharesTotal.toLocaleString()} | ${b.sharesTotal.toLocaleString()} | — |
| **Stale Share Rate** | ${fmtPercent(a.staleRate)} (${a.sharesStale.toLocaleString()}) | ${fmtPercent(b.staleRate)} (${b.sharesStale.toLocaleString()}) | **${(comparison.staleRateDelta > 0 ? '-' : '+') + fmtPercent(Math.abs(comparison.staleRateDelta))}** |
| **Rejected Share Rate** | ${fmtPercent(a.rejectionRate)} | ${fmtPercent(b.rejectionRate)} | — |

## Financial Impact

- **Net Recovered Hashrate:** +${fmtTh(comparison.recoveredThs)}
- **Daily Recovered Revenue:** +${fmtUsd(financial.dailyUsd)} / day ${financial.dailySats ? `(+${financial.dailySats.toLocaleString()} sats)` : ''}
- **Monthly Revenue:** +${fmtUsd(financial.monthlyUsd)} / month
- **Annualized Facility Gain:** +${fmtUsd(financial.annualUsd)} / year
- **Annual Value per ASIC:** +${fmtUsd(financial.annualPerMinerUsd)} / ASIC / year
`;
}
