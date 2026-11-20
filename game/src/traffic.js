// Traffic and pedestrians. Cars drive the road grid in the right-hand lane
// and turn at intersections; pedestrians wander the sidewalks, parks and the
// beach, and run when a car bears down on them or a shot goes off. Both keep
// to a small pool and respawn near the player when they drift too far away,
// so the streets around the camera are always busy.

import { BEACH, PALETTE, ROADS, TRAFFIC, WORLD } from './config.js';
import { pick } from './random.js';
import { nearestIntersection, pointInWater, pointOnRoad, randomRoadPoint, resolveCircle } from './city.js';

const CAR_COLORS = ['#d94f3d', '#3d7ea6', '#e8c547', '#7a9e7e', '#8d6b9e', '#c9c9c9', '#2e4057', '#e07a5f'];
const LANE = ROADS.lane;

function roadEndX(y) {
  // The two northern roads stop at the bay; the southern roads run the full width.
  return y < 760 ? 2340 : WORLD.width - 20;
}

export function createTraffic(random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i++) {
    cars.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, color: '#888', axis: 'v', dir: 1, road: 0, lastCross: -1, sporty: false, taxi: false, van: false });
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i++) {
    peds.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, color: '#888', tx: 0, ty: 0, fleeTimer: 0, downTimer: 0, hat: false, hatColor: '#888' });
  }

  function laneOffset(axis, dir) {
    // Right-hand traffic: the lane sits to the right of the direction of travel.
    return dir * LANE;
  }

  function placeCarOnRoad(car, x, y) {
    const v = ROADS.vertical;
    const h = ROADS.horizontal;
    const onV = Math.abs(x - v.reduce((a, b) => (Math.abs(x - a) < Math.abs(x - b) ? a : b))) < 46;
    const onH = Math.abs(y - h.reduce((a, b) => (Math.abs(y - a) < Math.abs(y - b) ? a : b))) < 46;
    if (onV && (!onH || random() < 0.5)) {
      car.axis = 'v';
      car.road = v.indexOf(v.reduce((a, b) => (Math.abs(x - a) < Math.abs(x - b) ? a : b)));
      car.dir = random() < 0.5 ? 1 : -1;
      car.x = v[car.road] + (car.dir === -1 ? LANE : -LANE);
      car.y = Math.max(30, Math.min(BEACH.top - 30, y));
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'h';
      car.road = h.indexOf(h.reduce((a, b) => (Math.abs(y - a) < Math.abs(y - b) ? a : b)));
      car.dir = random() < 0.5 ? 1 : -1;
      car.y = h[car.road] + (car.dir === 1 ? LANE : -LANE);
      car.x = Math.max(30, Math.min(roadEndX(h[car.road]) - 30, x));
      car.angle = car.dir === 1 ? 0 : Math.PI;
    }
    car.speed = TRAFFIC.carSpeed * (0.85 + random() * 0.3);
    car.color = pick(random, CAR_COLORS);
    car.sporty = random() < 0.2;
    // One in ten cars is a yellow cab, one in eight a slow delivery van.
    car.taxi = random() < 0.1;
    car.van = !car.sporty && random() < 0.12;
    if (car.taxi) car.color = PALETTE.taxiYellow;
    if (car.van) car.speed *= 0.8;
    if (car.sporty) car.speed *= 1.25;
    car.lastCross = -1;
    car.active = true;
  }

  function spawnCarNear(px, py) {
    const car = cars.find((c) => !c.active);
    if (!car) return;
    for (let tries = 0; tries < 12; tries++) {
      const p = randomRoadPoint(random);
      if (Math.hypot(p.x - px, p.y - py) < 350) continue;
      if (Math.hypot(p.x - px, p.y - py) > 950) continue;
      placeCarOnRoad(car, p.x, p.y);
      return;
    }
    const p = randomRoadPoint(random);
    placeCarOnRoad(car, p.x, p.y);
  }

  function spawnPedNear(px, py) {
    const ped = peds.find((p) => !p.active);
    if (!ped) return;
    for (let tries = 0; tries < 12; tries++) {
      const x = px + (random() - 0.5) * 1400;
      const y = py + (random() - 0.5) * 1000;
      if (x < 20 || y < 20 || x > WORLD.width - 20 || y > WORLD.height - 20) continue;
      if (pointInWater(x, y) || !pointOnRoad(x, y)) {
        if (random() < 0.6) continue;
      }
      ped.x = x; ped.y = y;
      ped.color = pick(random, PALETTE.pedShirt);
      ped.speed = TRAFFIC.pedSpeed * (0.8 + random() * 0.5);
      // A third of the crowd wears a hat — sun's out in Palmera Bay.
      ped.hat = random() < 0.33;
      ped.hatColor = pick(random, ['#f2c94c', '#e5534b', '#2e4057', '#f1faee']);
      ped.tx = x; ped.ty = y;
      ped.fleeTimer = 0;
      ped.downTimer = 0;
      ped.active = true;
      return;
    }
  }

  /** Fill the streets around the player at the start of a run. */
  function populate(px, py) {
    for (const car of cars) car.active = false;
    for (const ped of peds) ped.active = false;
    for (let i = 0; i < TRAFFIC.cars; i++) spawnCarNear(px, py);
    for (let i = 0; i < TRAFFIC.peds; i++) spawnPedNear(px, py);
  }

  /** Scare every pedestrian within `radius` of (x, y): they run away. */
  function scare(x, y, radius) {
    for (const ped of peds) {
      if (!ped.active || ped.downTimer > 0) continue;
      const d = Math.hypot(ped.x - x, ped.y - y);
      if (d < radius) {
        ped.fleeTimer = 1.2 + random() * 0.8;
        const a = Math.atan2(ped.y - y, ped.x - x);
        ped.tx = ped.x + Math.cos(a) * 220;
        ped.ty = ped.y + Math.sin(a) * 220;
      }
    }
  }

  function stepCar(car, dt, ctx) {
    if (!car.active) return;
    // Slow for the car ahead on the same road.
    let targetSpeed = car.speed;
    for (const other of cars) {
      if (other === car || !other.active || other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const side = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < 70 && side < 40) targetSpeed = 0;
    }
    // Slow for the player's car ahead.
    if (ctx.playerInCar && ctx.playerCar) {
      const along = car.axis === 'v' ? (ctx.playerCar.y - car.y) * car.dir : (ctx.playerCar.x - car.x) * car.dir;
      const side = car.axis === 'v' ? Math.abs(ctx.playerCar.x - car.x) : Math.abs(ctx.playerCar.y - car.y);
      if (along > 0 && along < 80 && side < 44) targetSpeed = 0;
    }
    const speed = targetSpeed;
    if (car.axis === 'v') {
      car.y += speed * car.dir * dt;
      if (car.y < 30) { car.dir = 1; car.angle = Math.PI / 2; car.x = ROADS.vertical[car.road] - LANE; }
      if (car.y > BEACH.top - 30) { car.dir = -1; car.angle = -Math.PI / 2; car.x = ROADS.vertical[car.road] + LANE; }
      // Turn at an intersection.
      for (let hi = 0; hi < ROADS.horizontal.length; hi++) {
        const hy = ROADS.horizontal[hi];
        if (Math.abs(car.y - hy) < 20 && car.lastCross !== hi && speed > 0) {
          car.lastCross = hi;
          if (random() < 0.4) {
            car.axis = 'h';
            car.road = hi;
            car.dir = random() < 0.5 ? 1 : -1;
            car.y = hy + (car.dir === 1 ? LANE : -LANE);
            car.angle = car.dir === 1 ? 0 : Math.PI;
          }
          break;
        }
      }
      if (Math.abs(car.y - ROADS.horizontal[car.lastCross >= 0 ? car.lastCross : 0]) > 60) car.lastCross = -1;
    } else {
      car.x += speed * car.dir * dt;
      const maxX = roadEndX(ROADS.horizontal[car.road]);
      if (car.x < 30) { car.dir = 1; car.angle = 0; car.y = ROADS.horizontal[car.road] + LANE; }
      if (car.x > maxX) { car.dir = -1; car.angle = Math.PI; car.y = ROADS.horizontal[car.road] - LANE; }
      for (let vi = 0; vi < ROADS.vertical.length; vi++) {
        const vx = ROADS.vertical[vi];
        if (Math.abs(car.x - vx) < 20 && car.lastCross !== vi && speed > 0) {
          car.lastCross = vi;
          if (random() < 0.4) {
            car.axis = 'v';
            car.road = vi;
            car.dir = random() < 0.5 ? 1 : -1;
            car.x = vx + (car.dir === -1 ? LANE : -LANE);
            car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
          }
          break;
        }
      }
      if (Math.abs(car.x - ROADS.vertical[car.lastCross >= 0 ? car.lastCross : 0]) > 60) car.lastCross = -1;
    }
    // Too far from the player: respawn closer.
    if (Math.hypot(car.x - ctx.playerX, car.y - ctx.playerY) > 1100) {
      car.active = false;
      spawnCarNear(ctx.playerX, ctx.playerY);
    }
  }

  function stepPed(ped, dt, ctx) {
    if (!ped.active) return;
    if (ped.downTimer > 0) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.active = false;
        spawnPedNear(ctx.playerX, ctx.playerY);
      }
      return;
    }
    // Flee a fast car bearing down.
    if (ctx.playerInCar && ctx.playerCar) {
      const d = Math.hypot(ped.x - ctx.playerCar.x, ped.y - ctx.playerCar.y);
      if (d < 100 && ctx.playerSpeed > 180) {
        ped.fleeTimer = 0.9;
        const a = Math.atan2(ped.y - ctx.playerCar.y, ped.x - ctx.playerCar.x);
        ped.tx = ped.x + Math.cos(a) * 200;
        ped.ty = ped.y + Math.sin(a) * 200;
      }
    }
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    const speed = ped.fleeTimer > 0 ? ped.speed * 2.4 : ped.speed;
    if (dist < 12) {
      // Pick a new stroll target: nearby, on a road or in a park or on the beach.
      for (let tries = 0; tries < 8; tries++) {
        const nx = ped.x + (random() - 0.5) * 700;
        const ny = ped.y + (random() - 0.5) * 500;
        if (nx < 20 || ny < 20 || nx > WORLD.width - 20 || ny > BEACH.top + 120) continue;
        if (pointInWater(nx, ny)) continue;
        ped.tx = nx;
        ped.ty = ny;
        break;
      }
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += (dx / dist) * speed * dt;
      ped.y += (dy / dist) * speed * dt;
      const pos = { x: ped.x, y: ped.y };
      resolveCircle(ctx.city, pos, 10);
      ped.x = pos.x;
      ped.y = pos.y;
    }
    ped.fleeTimer -= dt;
    if (Math.hypot(ped.x - ctx.playerX, ped.y - ctx.playerY) > 1200) {
      ped.active = false;
      spawnPedNear(ctx.playerX, ctx.playerY);
    }
  }

  function step(dt, ctx) {
    for (const car of cars) stepCar(car, dt, ctx);
    for (const ped of peds) stepPed(ped, dt, ctx);
  }

  return { cars, peds, populate, spawnCarNear, spawnPedNear, scare, step, laneOffset };
}
