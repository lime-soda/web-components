export interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
  bidDepth: number;
  bidSize: number;
  price: number;
  askSize: number;
  askDepth: number;
}

const CATEGORIES = [
  'US Treasury Bonds',
  'UK Gilts',
  'German Bunds',
  'Corporate Investment Grade',
  'Corporate High Yield',
  'Emerging Market Sovereign',
  'Municipal Bonds',
  'Agency Bonds',
  'Mortgage-Backed Securities',
  'Inflation-Linked Bonds',
  'Convertible Bonds',
  'Covered Bonds',
  'Green Bonds',
  'Euro Government Bonds',
  'Japanese Government Bonds',
  'Asian Corporate Bonds',
  'Supranational Bonds',
  'Development Bank Bonds',
];

const ISSUERS = [
  'US Treasury',
  'Apple Inc',
  'Microsoft Corp',
  'Goldman Sachs',
  'JPMorgan Chase',
  'Bank of America',
  'Verizon',
  'ExxonMobil',
  'Shell',
  'Berkshire Hathaway',
  'UK Treasury',
  'German Finance',
  'France Treasury',
  'Brazil Sovereign',
  'India Sovereign',
];

const MATURITIES = ['2027', '2028', '2029', '2030', '2032', '2035', '2040', '2050'];

/** Deterministic PRNG, so a story looks the same on every reload. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBonds(groupCount: number, instrumentCount: number, seed = 42): Bond[] {
  const random = mulberry32(seed);
  const bonds: Bond[] = [];
  const perGroup = Math.ceil(instrumentCount / groupCount);

  for (let g = 0; g < groupCount; g += 1) {
    const groupId = `group-${g}`;
    bonds.push({
      id: groupId,
      parentId: null,
      instrument: CATEGORIES[g % CATEGORIES.length]!,
      bidDepth: 0,
      bidSize: 0,
      price: 0,
      askSize: 0,
      askDepth: 0,
    });

    for (let i = 0; i < perGroup && bonds.length < instrumentCount + groupCount; i += 1) {
      const issuer = ISSUERS[Math.floor(random() * ISSUERS.length)]!;
      const maturity = MATURITIES[Math.floor(random() * MATURITIES.length)]!;
      const coupon = 1 + random() * 8;
      const bidSize = Math.floor(random() * 10) * 1000 + 1000;
      const askSize = Math.floor(random() * 10) * 1000 + 1000;

      bonds.push({
        id: `${groupId}-inst-${i}`,
        parentId: groupId,
        instrument: `${issuer} ${coupon.toFixed(3)}% ${maturity}`,
        bidDepth: bidSize,
        bidSize,
        price: 95 + random() * 10,
        askSize,
        askDepth: askSize,
      });
    }
  }

  return bonds;
}

/** One frame of market movement: a batch of rows with new prices and sizes. */
export function tick(rows: readonly Bond[], count: number, random = Math.random): Bond[] {
  const updates: Bond[] = [];
  const leaves = rows.filter((row) => row.parentId !== null);
  if (leaves.length === 0) return updates;

  for (let i = 0; i < count; i += 1) {
    const row = leaves[Math.floor(random() * leaves.length)]!;
    const sizeDelta = (Math.floor(random() * 5) - 2) * 1000;

    updates.push({
      ...row,
      price: Math.max(0, row.price + (random() - 0.5) * 0.02),
      bidSize: Math.max(1000, row.bidSize + sizeDelta),
      askSize: Math.max(1000, row.askSize + sizeDelta),
      bidDepth: Math.max(1000, row.bidDepth + sizeDelta),
      askDepth: Math.max(1000, row.askDepth + sizeDelta),
    });
  }

  return updates;
}
