// Palmera Bay itself: the road grid, the blocks and buildings inside it, the
// beach and sea to the south, the bay and marina docks to the east, the parks
// and palms, and the named places the missions send the player to. Everything
// is laid out once from the seeded random, so the same seed builds the same
// city. No drawing here — only data and the collision and road queries the
// world, the traffic and the police drive on.
import { BEACH, MARINA, PALETTE, ROADS, WORLD } from './config.js';
import { pick, range, shuffle } from './random.js';

/** Shopfront names for the streets: every city gets its own mix, none repeated. */
const SHOP_NAMES = [
  'Taco Luna', 'Cafe Sol', 'Palmera Records', 'Donut Bay', 'Surf & Turf',
  'Kicks & Co', 'Bait & Tackle', 'Neon Nails', 'Burger Bay', 'Flower Power',
  'Game Zone', 'Laundromat 24', 'Mango Smoothies', 'Bay Books',
];

/** Rooftop looks: flat, a pool, a garden, or an air-con unit. */
const ROOF_KINDS = ['flat', 'flat', 'flat', 'pool', 'garden', 'ac'];

/** Named places the story uses: garage, chop shop, docks, bank, hideout. */
export const PLACES = {
  garage: { name: "Moreno Motors", x: 600, y: 1346, label: 'Garage' },
  chopShop: { name: "Otis' Chop Shop", x: 1810, y: 1660, label: 'Chop Shop' },
  docks: { name: 'Palmera Docks', x: 2320, y: 500, label: 'Docks' },
  bank: { name: 'Bay Trust Bank', x: 1000, y: 640, label: 'Bank' },
  hideout: { name: 'Hideout', x: 210, y: 210, label: 'Hideout' },
  marina: { name: 'Marina Viewpoint', x: 2200, y: 940, label: 'Marina' },
  hospital: { name: 'Palmera General', x: 1410, y: 210, label: 'Hospital' },
  alley: { name: 'Back Alley', x: 1010, y: 990, label: 'Alley' },
  plaza: { name: 'Sol Plaza', x: 1010, y: 560, label: 'Plaza' },
  // v3 places: the smuggling drops and the race route run through them.
  casino: { name: 'Palmera Casino', x: 2200, y: 1250, label: 'Casino' },
  park: { name: 'Palm Court Park', x: 800, y: 1075, label: 'Park' },
};

const PARK_BLOCKS = [
  { x0: 646, y0: 946, x1: 954, y1: 1204 },
  { x0: 1446, y0: 246, x1: 1754, y1: 504 },
];

function blockIsPark(x0, y0, x1, y1) {
  return PARK_BLOCKS.some((p) => p.x0 === x0 && p.y0 === y0 && p.x1 === x1 && p.y1 === y1);
}

function blockIsMarina(x0, y0, x1, y1) {
  return x0 >= MARINA.x0 - 400 && y0 >= MARINA.y0 - 100 && x1 <= MARINA.x1 && y1 <= MARINA.y1 + 100;
}

/** The city, built once from the seeded random. */
export function generateCity(random) {
  const buildings = [];
  const palms = [];
  const parks = PARK_BLOCKS.map((p) => ({ ...p }));
  const shops = [];
  const lamps = [];
  const umbrellas = [];
  const shopNames = shuffle(random, SHOP_NAMES);
  let shopIndex = 0;
  const v = ROADS.vertical;
  const h = ROADS.horizontal;
  const half = ROADS.width / 2;
  for (let vi = 0; vi < v.length - 1; vi++) {
    for (let hi = 0; hi < h.length - 1; hi++) {
      const x0 = v[vi] + half + 14;
      const x1 = v[vi + 1] - half - 14;
      const y0 = h[hi] + half + 14;
      const y1 = h[hi + 1] - half - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (blockIsPark(x0, y0, x1, y1)) {
        for (let i = 0; i < 7; i++) {
          palms.push({ x: x0 + 30 + random() * (x1 - x0 - 60), y: y0 + 30 + random() * (y1 - y0 - 60), s: 0.8 + random() * 0.5 });
        }
        continue;
      }
      const marina = blockIsMarina(x0, y0, x1, y1);
      const count = marina ? 2 : 1 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const bw = 90 + random() * Math.max(20, (x1 - x0) / count - 110);
        const bh = 70 + random() * Math.max(20, (y1 - y0) - 90);
        const bx = x0 + ((x1 - x0) / count) * i + 8 + random() * 10;
        const by = y0 + 8 + random() * Math.max(4, (y1 - y0) - bh - 16);
        buildings.push({
          x: Math.min(bx, x1 - bw - 6),
          y: Math.min(by, y1 - bh - 6),
          w: Math.min(bw, x1 - 6 - bx),
          h: Math.min(bh, y1 - 6 - by),
          color: marina ? '#7a8a99' : pick(random, PALETTE.buildingRoof),
          height: marina ? 14 : 8 + random() * 22,
          roof: pick(random, ROOF_KINDS),
        });
      }
      // One shopfront per block at most, facing the street below it.
      if (!marina && shopIndex < shopNames.length && random() < 0.55) {
        const sw = 110 + random() * 60;
        shops.push({
          x: x0 + 20 + random() * Math.max(10, (x1 - x0) - sw - 40),
          y: y1 - 26,
          w: sw,
          name: shopNames[shopIndex],
          color: pick(random, PALETTE.shopAwning),
        });
        shopIndex += 1;
      }
    }
  }
  // Streetlamps along the vertical roads, every 300 px.
  for (const vx of v) {
    for (let y = 140; y < BEACH.top; y += 300) {
      lamps.push({ x: vx - half - 8, y });
      lamps.push({ x: vx + half + 8, y: y + 150 });
    }
  }
  // Beach umbrellas on the sand, with a towel beside each one.
  for (let x = 160; x < WORLD.width - 160; x += 260) {
    umbrellas.push({
      x: x + range(random, -40, 40),
      y: BEACH.top + range(random, 24, 120),
      color: pick(random, PALETTE.umbrella),
    });
  }
  // Palms along the beach road and the marina front.
  for (let x = 120; x < WORLD.width - 120; x += 130) {
    palms.push({ x: x + (random() - 0.5) * 40, y: BEACH.top + 24 + random() * 20, s: 0.9 + random() * 0.5 });
  }
  for (let y = 120; y < 1650; y += 170) {
    palms.push({ x: 2260 + random() * 30, y, s: 0.8 + random() * 0.4 });
  }
  // The bay water east of the marina, and the docks' piers.
  const piers = [
    { x: 2360, y: 340, w: 200, h: 26 },
    { x: 2360, y: 480, w: 240, h: 26 },
    { x: 2360, y: 620, w: 180, h: 26 },
  ];
  return { buildings, palms, parks, piers, shops, lamps, umbrellas };
}

/** True when the point is in the sea or the bay (cars and feet stay out). */
export function pointInWater(x, y) {
  if (y >= BEACH.waterTop) return true;
  if (x >= 2350 && y < MARINA.y1) return true;
  return false;
}

/** True when the point is on sand (walkable, but cars are slow there). */
export function pointOnSand(x, y) {
  return y >= BEACH.top && y < BEACH.waterTop && x < 2350;
}

/** The building a circle overlaps, or null. */
export function buildingHit(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/**
 * Push a circle (x, y, radius) out of buildings, water and the world edge.
 * Returns true when anything pushed it. The circle's position is edited in place.
 */
export function resolveCircle(city, pos, r) {
  let pushed = false;
  const b = buildingHit(city.buildings, pos.x, pos.y, r);
  if (b) {
    const dxLeft = pos.x + r - b.x;
    const dxRight = b.x + b.w - (pos.x - r);
    const dyTop = pos.y + r - b.y;
    const dyBottom = b.y + b.h - (pos.y - r);
    const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
    if (m === dxLeft) pos.x = b.x - r;
    else if (m === dxRight) pos.x = b.x + b.w + r;
    else if (m === dyTop) pos.y = b.y - r;
    else pos.y = b.y + b.h + r;
    pushed = true;
  }
  if (pointInWater(pos.x, pos.y)) {
    // Shove back toward the beach or the marina front, whichever is nearer.
    if (pos.y >= BEACH.waterTop) pos.y = BEACH.waterTop - r;
    else pos.x = 2350 - r;
    pushed = true;
  }
  if (pos.x < r) { pos.x = r; pushed = true; }
  if (pos.y < r) { pos.y = r; pushed = true; }
  if (pos.x > WORLD.width - r) { pos.x = WORLD.width - r; pushed = true; }
  if (pos.y > WORLD.height - r) { pos.y = WORLD.height - r; pushed = true; }
  return pushed;
}

/** Every road intersection, as {x, y} points the traffic and police drive on. */
export function intersections() {
  const out = [];
  for (const x of ROADS.vertical) for (const y of ROADS.horizontal) out.push({ x, y });
  return out;
}

/** The nearest intersection to a point (traffic picks its turns there). */
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of intersections()) {
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** True when a point is on a road surface (between the road edges). */
export function pointOnRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) if (Math.abs(x - vx) <= half && y >= 0 && y <= BEACH.top) return true;
  for (const hy of ROADS.horizontal) if (Math.abs(y - hy) <= half && x >= 0 && x <= WORLD.width) return true;
  return false;
}

/** A random point on a road, for spawning traffic near the player. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, ROADS.vertical) + (random() - 0.5) * 40, y: random() * BEACH.top };
  }
  return { x: random() * WORLD.width, y: pick(random, ROADS.horizontal) + (random() - 0.5) * 40 };
}
