// Palmera Bay — every tuning number, colour and key in one place.
// The world is a 2600 x 1900 sun-soaked coastal city; the camera shows a
// 1280 x 720 window of it and scales that window to the browser.

export const STEP = 1 / 60;

export const WORLD = { width: 2600, height: 1900 };
export const VIEW = { width: 1280, height: 720 };

/** Roads: vertical x positions and horizontal y positions (centre lines). */
export const ROADS = {
  vertical: [200, 600, 1000, 1400, 1800, 2200],
  horizontal: [200, 550, 900, 1250, 1600],
  width: 92,
  lane: 24,
};

export const BEACH = { top: 1700, waterTop: 1852 };
export const MARINA = { x0: 2280, y0: 280, x1: 2600, y1: 760 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 350,
  health: 100,
  punchDamage: 34,
  punchRange: 34,
  punchCooldown: 0.38,
  shotCooldown: 0.17,
  bulletSpeed: 950,
  bulletDamage: 34,
  magSize: 12,
  reloadTime: 1.1,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 430,
  brake: 700,
  reverseMax: 190,
  steer: 2.35,
  drag: 0.55,
  handbrakeGrip: 0.25,
  maxSpeed: 560,
  sportsMaxSpeed: 660,
  health: 150,
};

/** Weapons: the pistol Jax starts with, and the SMG found in weapon crates. */
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, cooldown: 0.17, mag: 12 },
  smg: { name: 'SMG', damage: 20, cooldown: 0.08, mag: 30 },
};

/** Weapon crates: fixed spots, one SMG each, restocked after a while. */
export const WEAPON_CRATES = { respawn: 45 };

/** Garage repair: full car health for cash, only at Moreno Motors (key F). */
export const REPAIR = { cost: 50, radius: 110 };

/** Police roadblocks: at three stars and up the PD seals an intersection ahead. */
export const ROADBLOCK = { minWanted: 3, cars: 2, duration: 25, cooldown: 20, triggerRange: 220 };

/** The Neon Grand Prix: Rico's rival car, beatable but quick. */
export const RIVAL = { maxSpeed: 490, accel: 380, chaseRange: 90 };

export const TRAFFIC = { cars: 18, peds: 32, carSpeed: 150, pedSpeed: 55 };

export const POLICE = {
  maxCars: 6,
  chaseSpeed: 500,
  ramDamage: 6,
  arrestRange: 26,
  officerSpeed: 300,
  spawnDistance: 700,
};

/** The police helicopter that circles at five stars: visual pressure only — it never shoots. */
export const HELI = { speed: 260, follow: 1.1, leaveSpeed: 420 };

/** Near-miss bonus: threading past traffic at speed pays a little cash. */
export const NEAR_MISS = { minGap: 46, maxGap: 84, minSpeed: 300, bonus: 10 };

/** Courier streak: consecutive deliveries without failing pay a growing bonus. */
export const COURIER = { baseReward: 150, streakBonus: 25, streakMax: 4, time: 90 };

export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  killPed: 2,
  ramPolice: 1,
  decayDelay: 9,
  decayInterval: 7,
};

export const MONEY = { start: 150, pickup: 50, courier: 150, bustedFine: 200 };

export const SAVE_KEY = 'palmera-bay.save.v1';

export const PALETTE = {
  backdrop: '#101820',
  water: '#2fa8b8',
  waterDeep: '#1f7f96',
  sand: '#e8d29a',
  grass: '#7fb069',
  grassDark: '#6a9a58',
  road: '#3d414c',
  roadEdge: '#565b68',
  lane: '#e8e4d2',
  sidewalk: '#b8b2a4',
  sidewalkEdge: '#9a9484',
  buildingRoof: ['#d96c4f', '#e8a87c', '#7a9cc6', '#c65d7b', '#8fae8b', '#e0b34c', '#9b7ec4', '#5d8a7a'],
  buildingEdge: '#2c2f38',
  palmTrunk: '#8a6b4a',
  palmLeaf: '#3f8f4f',
  player: '#2ec4b6',
  playerDark: '#1d8a80',
  policeCar: '#f1faee',
  policeLightA: '#2f6df6',
  policeLightB: '#f6352f',
  enemy: '#c94f4f',
  enemyDark: '#8f2f2f',
  pedShirt: ['#e07a5f', '#81b29a', '#f2cc8f', '#6d9dc5', '#b5838d', '#e9c46a'],
  cash: '#f2c94c',
  marker: '#f2c94c',
  // v2 visuals: warm sun, glittering water, shopfronts and street furniture.
  sunGlow: 'rgba(255, 214, 130, 0.16)',
  waterShine: 'rgba(255, 255, 255, 0.35)',
  crosswalk: 'rgba(232, 228, 210, 0.85)',
  taxiYellow: '#f2c94c',
  taxiCheck: '#1a1a1a',
  umbrella: ['#e5534b', '#2f6df6', '#f2c94c', '#7a9cc6', '#c65d7b'],
  shopAwning: ['#d96c4f', '#2f6df6', '#3f8f4f', '#e0b34c', '#c65d7b'],
  heliBody: '#2e4057',
  heliGlass: '#9fc3d8',
  text: '#eef1f5',
  muted: '#aab3c0',
  panel: 'rgba(12, 18, 26, 0.78)',
  panelEdge: 'rgba(242, 201, 76, 0.55)',
  gold: '#f2c94c',
  red: '#e5534b',
  star: '#ffd94a',
  health: '#58d68d',
  healthLow: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['Space'],
  reload: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Space', 'Enter'],
  mute: ['KeyM'],
  job: ['KeyT'],
  horn: ['KeyH'],
  repair: ['KeyF'],
};
