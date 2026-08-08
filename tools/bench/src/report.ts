/** Shared measurement helpers. Deliberately tiny — the budgets are the point. */

export interface Measurement {
  readonly label: string;
  readonly median: number;
  readonly p95: number;
  readonly worst: number;
  readonly runs: number;
}

/**
 * Runs `fn` repeatedly and reports the distribution.
 *
 * Median rather than mean, and p95 alongside: a grid that is usually fast but
 * stalls one frame in twenty is not fast, and an average hides exactly that.
 */
export function measure(label: string, runs: number, fn: () => void): Measurement {
  // Warm up so the first-run compile does not land in the sample.
  for (let i = 0; i < Math.min(3, runs); i += 1) fn();

  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);

  return {
    label,
    median: samples[Math.floor(samples.length / 2)] ?? 0,
    p95: samples[Math.floor(samples.length * 0.95)] ?? 0,
    worst: samples[samples.length - 1] ?? 0,
    runs,
  };
}

export function report(measurement: Measurement, budgetMs: number): void {
  const { label, median, p95, worst, runs } = measurement;
  const verdict = median <= budgetMs ? 'ok' : 'OVER BUDGET';
  // eslint-disable-next-line no-console -- a benchmark's output is its purpose
  console.log(
    `${label.padEnd(46)} median ${median.toFixed(2).padStart(8)}ms  ` +
      `p95 ${p95.toFixed(2).padStart(8)}ms  worst ${worst.toFixed(2).padStart(8)}ms  ` +
      `(${runs} runs, budget ${budgetMs}ms — ${verdict})`,
  );
}
