// The wanted system and the Palmera Bay PD. Stars rise with crimes — stealing
// a car, shooting, knocking a pedestrian down, ramming a police car — and the
// department answers with more cars the higher the heat. Police cars chase on
// the roads and ram; when the player is on foot, an officer gets out and runs
// him down, and an arrest means a fine and a trip to the hospital. Stars cool
// off only when the player stays out of trouble and out of sight for a while.

import { HELI, POLICE, WANTED, WORLD } from './config.js';
import { randomRoadPoint, resolveCircle } from './city.js';

const POLICE_CARS = 6;
const OFFICERS = 6;

export function createPolice(random) {
  const cars = [];
  for (let i = 0; i < POLICE_CARS; i++) {
    cars.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, lightTimer: 0, ramTimer: 0 });
  }
  const officers = [];
  for (let i = 0; i < OFFICERS; i++) {
    officers.push({ active: false, x: 0, y: 0, angle: 0, speed: 0 });
  }
  // The helicopter: circles overhead at five stars, leaves when the heat drops.
  const heli = { active: false, leaving: false, x: 0, y: 0, angle: 0, rotor: 0 };
  let wanted = 0;
  let decayTimer = 0;

  function addWanted(n) {
    if (n <= 0) return;
    const before = wanted;
    wanted = Math.min(WANTED.max, wanted + n);
    if (wanted > before) decayTimer = WANTED.decayDelay;
    return wanted > before;
  }

  function clearWanted() {
    wanted = 0;
    decayTimer = 0;
    for (const car of cars) car.active = false;
    for (const officer of officers) officer.active = false;
    heli.active = false;
    heli.leaving = false;
  }

  function activeCars() {
    let n = 0;
    for (const car of cars) if (car.active) n++;
    return n;
  }

  function wantedCars() {
    if (wanted <= 0) return 0;
    return Math.min(POLICE.maxCars, wanted === 5 ? 6 : wanted + 1);
  }

  function spawnCarNear(px, py) {
    const car = cars.find((c) => !c.active);
    if (!car) return;
    for (let tries = 0; tries < 10; tries++) {
      const p = randomRoadPoint(random);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < 500 || d > 900) continue;
      car.x = p.x;
      car.y = p.y;
      car.angle = Math.atan2(py - p.y, px - p.x);
      car.speed = 200;
      // The light bars flash out of sync across cars.
      car.lightTimer = random() * 2;
      car.active = true;
      return;
    }
  }

  function spawnOfficer(x, y) {
    const officer = officers.find((o) => !o.active);
    if (!officer) return;
    officer.x = x;
    officer.y = y;
    officer.angle = 0;
    officer.speed = POLICE.officerSpeed;
    officer.active = true;
  }

  /** Distance to the nearest active police unit, or null when none are out. */
  function nearestDistance(px, py) {
    let best = null;
    for (const car of cars) {
      if (!car.active) continue;
      const d = Math.hypot(car.x - px, car.y - py);
      if (best === null || d < best) best = d;
    }
    for (const officer of officers) {
      if (!officer.active) continue;
      const d = Math.hypot(officer.x - px, officer.y - py);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  function stepCar(car, dt, ctx) {
    const tx = ctx.playerInCar && ctx.playerCar ? ctx.playerCar.x : ctx.playerX;
    const ty = ctx.playerInCar && ctx.playerCar ? ctx.playerCar.y : ctx.playerY;
    const dx = tx - car.x;
    const dy = ty - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 2.6;
    car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const maxSpeed = POLICE.chaseSpeed * (0.85 + wanted * 0.06);
    car.speed = Math.min(maxSpeed, car.speed + 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const pos = { x: car.x, y: car.y };
    if (resolveCircle(ctx.city, pos, 20)) {
      car.x = pos.x;
      car.y = pos.y;
      car.speed *= 0.4;
    } else {
      car.x = pos.x;
      car.y = pos.y;
    }
    car.lightTimer += dt;
    car.ramTimer -= dt;
    // Ram the player's car (once per cooldown — contact is not a shredder);
    // bump the player on foot.
    if (ctx.playerInCar && ctx.playerCar) {
      if (dist < 52 && car.speed > 60 && car.ramTimer <= 0) {
        car.ramTimer = 1.5;
        car.speed *= 0.35;
        if (ctx.onRam) ctx.onRam(POLICE.ramDamage);
      }
    } else if (dist < 40) {
      car.speed = 0;
      // The officer gets out and gives chase on foot — from two stars up.
      if (wanted >= 2 && officers.every((o) => !o.active)) spawnOfficer(car.x, car.y);
    }
    if (dist > 1400) car.active = false;
  }

  function stepOfficer(officer, dt, ctx) {
    if (ctx.playerInCar) {
      // The player drove off: the officer heads back to the car.
      officer.active = false;
      return;
    }
    const dx = ctx.playerX - officer.x;
    const dy = ctx.playerY - officer.y;
    const dist = Math.hypot(dx, dy) || 1;
    officer.angle = Math.atan2(dy, dx);
    officer.x += (dx / dist) * officer.speed * dt;
    officer.y += (dy / dist) * officer.speed * dt;
    const pos = { x: officer.x, y: officer.y };
    resolveCircle(ctx.city, pos, 11);
    officer.x = pos.x;
    officer.y = pos.y;
    if (dist < POLICE.arrestRange) {
      officer.active = false;
      if (ctx.onArrest) ctx.onArrest();
    }
    if (dist > 1000) officer.active = false;
  }

  function step(dt, ctx) {
    // Reinforce up to the wanted level's car count.
    const want = wantedCars();
    if (activeCars() < want) spawnCarNear(ctx.playerX, ctx.playerY);
    for (const car of cars) if (car.active) stepCar(car, dt, ctx);
    // The helicopter: arrives at five stars, shadows the player, and flies
    // off toward the north-west corner when the heat drops below five.
    if (wanted === 5) {
      if (!heli.active) {
        heli.active = true;
        heli.leaving = false;
        heli.x = ctx.playerX - 500;
        heli.y = ctx.playerY - 400;
      }
      const dx = ctx.playerX - heli.x;
      const dy = ctx.playerY - heli.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(HELI.speed, d * HELI.follow);
      heli.x += (dx / d) * sp * dt;
      heli.y += (dy / d) * sp * dt;
      heli.angle = Math.atan2(dy, dx);
    } else if (heli.active) {
      heli.leaving = true;
      heli.x -= HELI.leaveSpeed * dt;
      heli.y -= HELI.leaveSpeed * 0.7 * dt;
      if (heli.x < -120 || heli.y < -120) {
        heli.active = false;
        heli.leaving = false;
      }
    }
    heli.rotor += dt * 28;
    // Police cars don't stack on one spot: push them apart from each other.
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    for (const officer of officers) if (officer.active) stepOfficer(officer, dt, ctx);
    // Cool off when the player is out of sight and out of trouble.
    if (wanted > 0) {
      const near = nearestDistance(ctx.playerX, ctx.playerY);
      if (near === null || near > 500) {
        decayTimer -= dt;
        if (decayTimer <= 0) {
          wanted -= 1;
          decayTimer = WANTED.decayInterval;
          if (wanted === 0) clearWanted();
        }
      } else {
        decayTimer = WANTED.decayDelay;
      }
    }
  }

  return {
    cars, officers, heli,
    get wanted() { return wanted; },
    addWanted, clearWanted, nearestDistance, step,
  };
}
