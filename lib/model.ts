// Token Radar, model radar-3: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks every rankable pre-token protocol in the snapshot: the watchlist (the floor,
// never a ceiling) plus every other pre-token protocol that is not a wrapped, staked or bridged
// product of a token that already trades. A protocol is pre-token when its record carries no token
// (no market cap, no CoinGecko id, no symbol); live-token protocols are kept apart and shown with
// the market's own values, never mixed into the ranked board.
//
// The implied value is a comps curve FITTED on the snapshot's own live-token protocols, not a
// hand-picked multiple. On this snapshot the curve is a power law in TVL:
//
//   log(mcap) = intercept + slope x log(TVL), fitted by ordinary least squares on every live-token
//     protocol that records a market cap and a TVL (128 comps on this snapshot).
//
// The fit is done at run time, from the snapshot alone, and it is validated out of sample before
// it is trusted:
//
//   - The multiple falls with size: the median market-cap / TVL ratio is 0.88 in the smallest TVL
//     quartile of live comps and 0.05 in the largest, an 18-fold fall. A flat multiple (radar-2's
//     category median, 0.34 for Dexs) pays the big protocols far too much; the curve charges them
//     the multiple their own size implies. The fitted slope is about 0.52: value grows with the
//     square root of TVL, not with TVL itself.
//   - 5-fold cross-validation (folds by a hash of the slug, so the split is fixed): the curve's
//     out-of-sample R-squared on log market cap is about 0.17, and the median absolute error on
//     the dollar value is about 87%. Comps are noisy — a live token's multiple spans 0.006 to
//     5.1, a thousand-fold — so the curve ranks by the central tendency, it does not promise a
//     point value.
//   - The alternatives were fitted the same way and LOST out of sample, so they are not used:
//     adding seven-day growth (CV R-squared about 0.16), adding age (about 0.11), adding chains
//     (about 0.09), and radar-2's category-median multiple (CV R-squared about -0.04: worse than
//     the mean). Growth, age and chains were tested as extra terms; each lowered the validated
//     score, so the curve keeps TVL alone. The dashboard shows this ablation table, and each
//     row's detail view shows the protocol's own growth and age as context, with the fit's
//     verdict that neither carries a premium on these comps.
//   - A time-split holdout (train on the oldest 80% of dated comps, test on the newest 20%)
//     is reported too; it is the hardest test, because the newest listings are the most volatile,
//     and its R-squared is below zero on this snapshot — the curve is a ranking tool for the
//     typical launch, not a forecaster of any single new listing.
//
// No protocol name is ever special-cased: the same fitted curve scores every row, the fit uses
// only live-token protocols (no pre-token protocol enters it), and the dashboard states the
// formula, the coefficients, the number of comps and the validation numbers.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The comps curve the snapshot itself fits: log(mcap) = intercept + slope x log(TVL). */
export interface FittedCurve {
  intercept: number;
  slope: number;
  /** Live-token protocols that entered the fit. */
  n_comps: number;
  /** Median age, in days, of the dated comps (null ages are set to this when a term needs one). */
  median_age_days: number;
}

/** One out-of-sample check, with its own numbers. */
export interface Validation {
  /** 5-fold cross-validated R-squared on log market cap (folds by a hash of the slug). */
  cv_r2: number;
  /** 5-fold cross-validated median absolute percentage error on the dollar value. */
  cv_med_ape: number;
  /** Time-split holdout R-squared (train oldest 80% of dated comps, test newest 20%). */
  holdout_r2: number;
  /** Time-split holdout median absolute percentage error on the dollar value. */
  holdout_med_ape: number;
  /** Dated comps in the holdout test set. */
  holdout_n: number;
}

/** One row of the ablation table: a rival spec, fitted and validated the same way. */
export interface AblationRow {
  label: string;
  cv_r2: number;
}

/** The whole fitted model, as the dashboard states it. */
export interface FittedModel {
  version: string;
  curve: FittedCurve;
  validation: Validation;
  ablation: AblationRow[];
  /** Median market-cap / TVL ratio by TVL quartile of the live comps, smallest first. */
  ratio_quartiles: number[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    /** Implied value over TVL at this protocol's size: the curve's multiple, rounded. */
    curve_multiple: number;
    /** Natural log of the protocol's TVL, rounded. */
    log_tvl: number;
    /** Seven-day change, clamped to -50..150, as tested by the fit. */
    growth_pct: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included so the page shows board.json's own steps. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  /** The curve's multiple at this row's TVL, full precision: the page recomputes from it. */
  curve_multiple: number;
  /** Natural log of the row's TVL, full precision: the page recomputes from it. */
  log_tvl: number;
  /** Seven-day change, clamped to -50..150, as the fit tested it. */
  growth_pct: number;
  age_days: number | null;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  /** The fitted model: its curve, its validation and its ablation table. */
  model: FittedModel;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The middle value of a sorted list, or null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A fixed hash of a slug, so the validation folds never move between runs. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Ordinary least squares by the normal equations with Gaussian elimination. */
function ols(features: number[][], target: number[]): number[] {
  const n = features[0]!.length;
  const a: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => features.reduce((s, row) => s + row[i]! * row[j]!, 0)),
  );
  const b: number[] = Array.from({ length: n }, (_, i) => features.reduce((s, row, k) => s + row[i]! * target[k]!, 0));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[piv]![c]!)) piv = r;
    [a[c], a[piv]] = [a[piv]!, a[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = a[r]![c]! / a[c]![c]!;
      for (let k = c; k < n; k++) a[r]![k]! -= f * a[c]![k]!;
      b[r]! -= f * b[c]!;
    }
  }
  const beta = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let k = r + 1; k < n; k++) s -= a[r]![k]! * beta[k]!;
    beta[r] = s / a[r]![r]!;
  }
  return beta;
}

/** The live-token protocols the curve is fitted on: a market cap and a TVL, both positive. */
export function liveComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/**
 * One protocol's features for a spec: the TVL curve alone ('tvl'), or with seven-day growth
 * ('g'), age ('a') and chains ('c') added. Growth is clamped to -50..150, age is log1p of days
 * (unknown ages take the comps' median), chains is min(chains - 1, 4).
 */
function featuresFor(p: SnapshotProtocol, asOf: string, medianAge: number, spec: string): number[] {
  const row = [1, Math.log(p.tvl_usd)];
  if (spec.includes('g')) row.push(finite(p.change_7d, 0) / 100);
  if (spec.includes('a')) row.push(Math.log1p(ageDays(asOf, p.listed_at) ?? medianAge));
  if (spec.includes('c')) row.push(Math.min(Math.max(p.chains.length, 1) - 1, 4));
  return row;
}

/** A fitted spec: its coefficients and a predictor of log market cap. */
function fitSpec(train: SnapshotProtocol[], asOf: string, spec: string): (p: SnapshotProtocol) => number {
  const medianAge = median(train.map((p) => ageDays(asOf, p.listed_at)).filter((a): a is number => a !== null)) ?? 365;
  const beta = ols(
    train.map((p) => featuresFor(p, asOf, medianAge, spec)),
    train.map((p) => Math.log(p.mcap_usd!)),
  );
  return (p) => {
    const f = featuresFor(p, asOf, medianAge, spec);
    return f.reduce((s, v, i) => s + v * beta[i]!, 0);
  };
}

/** radar-2's category-median multiple, fitted the same way, as one rival spec. */
function fitCategoryMedian(train: SnapshotProtocol[]): (p: SnapshotProtocol) => number {
  const byCategory = new Map<string, number[]>();
  for (const p of train) {
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(key, list);
  }
  const global = median(train.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0.2;
  return (p) => {
    const ratios = byCategory.get(p.category ?? 'Other');
    const mult = ratios !== undefined && ratios.length >= 3 ? median(ratios) ?? global : global;
    return Math.log(p.tvl_usd * Math.min(0.6, Math.max(0.05, mult)));
  };
}

/** A spec's 5-fold cross-validated R-squared on log market cap, and its median dollar error. */
function crossValidate(comps: SnapshotProtocol[], asOf: string, spec: string): { r2: number; medApe: number } {
  const folds: SnapshotProtocol[][] = [[], [], [], [], []];
  for (const p of comps) folds[fnv1a(p.slug) % 5]!.push(p);
  const meanLog = comps.reduce((s, p) => s + Math.log(p.mcap_usd!), 0) / comps.length;
  let ssRes = 0;
  let ssTot = 0;
  const apes: number[] = [];
  for (let f = 0; f < 5; f++) {
    const test = folds[f]!;
    const train = folds.flatMap((x, i) => (i === f ? [] : x));
    const predict = spec === 'catmedian' ? fitCategoryMedian(train) : fitSpec(train, asOf, spec);
    for (const p of test) {
      const predicted = predict(p);
      const actual = Math.log(p.mcap_usd!);
      ssRes += (actual - predicted) ** 2;
      ssTot += (actual - meanLog) ** 2;
      apes.push(Math.abs(Math.exp(predicted) - p.mcap_usd!) / p.mcap_usd!);
    }
  }
  apes.sort((a, b) => a - b);
  return { r2: 1 - ssRes / ssTot, medApe: apes[Math.floor(apes.length / 2)] ?? 1 };
}

/** The time-split holdout for the chosen spec: oldest 80% train, newest 20% test. */
function timeHoldout(comps: SnapshotProtocol[], asOf: string, spec: string): { r2: number; medApe: number; n: number } {
  const dated = comps
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => Date.parse(a.listed_at!) - Date.parse(b.listed_at!));
  const cut = Math.floor(dated.length * 0.8);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  const predict = fitSpec(train, asOf, spec);
  const meanLog = train.reduce((s, p) => s + Math.log(p.mcap_usd!), 0) / train.length;
  let ssRes = 0;
  let ssTot = 0;
  const apes: number[] = [];
  for (const p of test) {
    const predicted = predict(p);
    const actual = Math.log(p.mcap_usd!);
    ssRes += (actual - predicted) ** 2;
    ssTot += (actual - meanLog) ** 2;
    apes.push(Math.abs(Math.exp(predicted) - p.mcap_usd!) / p.mcap_usd!);
  }
  apes.sort((a, b) => a - b);
  return { r2: 1 - ssRes / ssTot, medApe: apes[Math.floor(apes.length / 2)] ?? 1, n: test.length };
}

/**
 * The fitted model: the TVL power-law curve, its out-of-sample validation, and the ablation
 * table of the rival specs that were fitted and validated the same way and lost.
 */
export function buildFittedModel(snapshot: Snapshot): FittedModel {
  const comps = liveComps(snapshot);
  const medianAge = median(comps.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null)) ?? 365;
  const beta = ols(
    comps.map((p) => featuresFor(p, snapshot.as_of, medianAge, 'tvl')),
    comps.map((p) => Math.log(p.mcap_usd!)),
  );
  const curve: FittedCurve = { intercept: beta[0]!, slope: beta[1]!, n_comps: comps.length, median_age_days: medianAge };
  const cv = crossValidate(comps, snapshot.as_of, 'tvl');
  const hold = timeHoldout(comps, snapshot.as_of, 'tvl');
  const ablation: AblationRow[] = [
    { label: 'TVL power-law curve (chosen)', cv_r2: cv.r2 },
    { label: 'Curve + 7-day growth', cv_r2: crossValidate(comps, snapshot.as_of, 'tvl+g').r2 },
    { label: 'Curve + growth + age', cv_r2: crossValidate(comps, snapshot.as_of, 'tvl+g+a').r2 },
    { label: 'Curve + growth + age + chains', cv_r2: crossValidate(comps, snapshot.as_of, 'tvl+g+a+c').r2 },
    { label: 'Category-median multiple (radar-2)', cv_r2: crossValidate(comps, snapshot.as_of, 'catmedian').r2 },
  ];
  const sorted = [...comps].sort((a, b) => a.tvl_usd - b.tvl_usd);
  const quartiles: number[] = [];
  for (let q = 0; q < 4; q++) {
    const seg = sorted.slice(Math.floor((q * sorted.length) / 4), Math.floor(((q + 1) * sorted.length) / 4));
    quartiles.push(median(seg.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0);
  }
  return {
    version: MODEL_VERSION,
    curve,
    validation: { cv_r2: cv.r2, cv_med_ape: cv.medApe, holdout_r2: hold.r2, holdout_med_ape: hold.medApe, holdout_n: hold.n },
    ablation,
    ratio_quartiles: quartiles,
  };
}

/** The curve's implied value for one protocol, with the figures the page recomputes from. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  curve: FittedCurve,
): { implied: number; curveMultiple: number; logTvl: number; growthPct: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const logTvl = Math.log(protocol.tvl_usd);
  const implied = Math.max(1, Math.round(Math.exp(curve.intercept + curve.slope * logTvl)));
  const growthPct = Math.min(150, Math.max(-50, finite(protocol.change_7d, 0)));
  return { implied, curveMultiple: implied / protocol.tvl_usd, logTvl, growthPct, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A wrapped or staked product's name carries one of these whole words. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** An exchange's own product begins with its name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades — the same exclusion the watchlist rule applies, extended
 * to the early rows below the floor, so the radar never ranks WBTC-style products as launches.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, curve: FittedCurve): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, not just the
  // biggest few by TVL — the radar exists to find these early. A chosen protocol stays chosen.
  // Above the floor the watchlist is authoritative: the snapshot's ten fields cannot see
  // DefiLlama's parentProtocol, so a protocol above the floor that the watchlist leaves out is a
  // sub-product of another protocol (a perps desk, a curator, a regional version) and is not
  // ranked as a launch of its own. Below the floor no such line is drawn: every rankable
  // pre-token protocol is in, which is 138 early rows on this snapshot.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const { implied, curveMultiple, logTvl, growthPct, age } = impliedValue(p, snapshot.as_of, curve);
    return { p, implied, curveMultiple, logTvl, growthPct, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      curve_multiple: round4(s.curveMultiple),
      log_tvl: round4(s.logTvl),
      growth_pct: round2(s.growthPct),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow a small amount against it and repay it.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in the pair it lists first, and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one small position in a market that closes within a week.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} run by its largest curator and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in your wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for a protocol you already use, and keep the policy.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold the index token.`;
  if (c.includes('payment') || c.includes('pay')) return `Route $${capital} of payments through ${name} on ${chain} across two separate weeks.`;
  if (c.includes('launchpad')) return `Stake $${capital} on ${name} on ${chain} and join one sale or allocation round it opens.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('ai') || c.includes('decentralized ai')) return `Deposit $${capital} into ${name} on ${chain} and run one of its agent or compute tasks to completion.`;
  if (c.includes('chain')) return `Bridge $${capital} to the ${name} chain and use one of its native apps for a week.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second, different action, so the farm is a pattern of use, not one deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Swap $${small} through ${name}'s market on ${chain} and vote once in its governance, if it has one.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Swap $${small} through ${name} on ${chain} in the opposite direction and add it to a second pool.`;
  if (c.includes('yield')) return `Move $${small} into a second ${name} vault on a different chain it supports and compare the yields.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Close the first position on ${name}, then open a second one half its size on ${chain}.`;
  if (c.includes('prediction')) return `Place a second $${small} position on ${name} in a market on a different topic.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${small} into a second ${name} vault on ${chain} with a different curator.`;
  if (c.includes('stable')) return `Swap $${small} of the stable asset back to USDC through ${name} on ${chain}, then re-deposit it.`;
  if (c.includes('rwa')) return `Check the ${name} asset's backing report on ${chain} and add $${small} more to the position.`;
  if (c.includes('insurance')) return `File a test quote for a second protocol on ${name} and compare its cover price.`;
  if (c.includes('index')) return `Rebalance $${small} between two assets inside the ${name} index on ${chain}.`;
  return `Use ${name} a second way on ${chain}: swap $${small} through it, or vote once if it opens governance.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Every step names a concrete amount, a chain, or a number of days.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const otherChain = p.chains.length > 1 ? p.chains[1]! : chain;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm on ${chain}, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${Math.max(10, Math.round(capital / 5))} of capital and $2 of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week on ${nameOf(p)}, such as a deposit, a borrow, a swap or a vote, and never leave the position empty.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and keep it on ${chain}${otherChain !== chain ? ` with a smaller position on ${otherChain}` : ''}.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Once a month, open the protocol's own points or rewards page from its own site and check the wallet's standing there.`,
      cost: 'no fee to check',
      time: '10 minutes a month',
    },
    {
      text: `Before any claim, check the token contract address on the protocol's own page and never pay a fee to claim; a claim that asks for payment is a scam.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then plan the exit: withdraw in two parts and keep the log for tax.`,
      cost: 'about $4 of gas to unwind',
      time: '5 minutes to log, 15 to exit',
    },
  ];
}

function nameOf(p: SnapshotProtocol): string {
  return p.name;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan and the model breakdown. */
export function radarRow(row: BoardRow): RadarRow {
  // The page recomputes the row from these figures, so they are the full-precision values the
  // model itself used: the log of the TVL straight from the TVL, and the curve's multiple as the
  // implied value over the TVL. The board's rounded copies would recompute to a different dollar.
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    curve_multiple: row.implied_value_usd / row.tvl_usd,
    log_tvl: Math.log(row.tvl_usd),
    growth_pct: row.model.growth_pct,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fitted = buildFittedModel(snapshot);
  const board = buildBoard(snapshot, fitted.curve);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: fitted,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
