// The screenshot scenes behind ?shot=chase|foot|mission|drive. Each one sets
// the real world up — teleport the player, put him in a car, start a mission
// mid-stage, raise the wanted level — then plays the real rules forward for a
// fixed number of steps, steered by a simple autopilot that follows the roads
// toward the objective. The frame is what a short game really looks like, and
// the same seed always stages the same frame.

import { ROADS, STEP } from './config.js';
import { PLACES } from './city.js';

/** A fake input the autopilot steers with: same shape as the real input. */
export function makeShotInput() {
  const keys = { up: false, down: false, left: false, right: false, run: false, space: false };
  let mouse = { x: 640, y: 360, down: false, seen: true };
  return {
    keys,
    setMouse(next) { mouse = next; },
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    throttle() { return (keys.up ? 1 : 0) - (keys.down ? 1 : 0); },
    steer() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    running() { return keys.run; },
    punchHeld() { return keys.space; },
    mouse() { return mouse; },
    takeActions() { return 0; },
  };
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function steerToward(input, fromX, fromY, fromAngle, toX, toY) {
  const want = Math.atan2(toY - fromY, toX - fromX);
  const diff = normalizeAngle(want - fromAngle);
  input.keys.left = diff < -0.06;
  input.keys.right = diff > 0.06;
  return diff;
}

/**
 * Drive the player's car along the roads toward (tx, ty): aim at a point
 * ahead on the current road's centre line, and at an intersection pick the
 * turn that gets closest to the target (never a U-turn, never into the bay).
 */
function roadPilot(input, world, tx, ty) {
  const car = world.player.car;
  if (!car) {
    // No car, no driving: let go of the keys instead of walking off.
    input.keys.up = false;
    input.keys.down = false;
    input.keys.left = false;
    input.keys.right = false;
    return;
  }
  const hRoads = ROADS.horizontal;
  const vRoads = ROADS.vertical;
  const onH = hRoads.reduce((best, hy) => (Math.abs(car.y - hy) < Math.abs(car.y - best) ? hy : best), hRoads[0]);
  const onV = vRoads.reduce((best, vx) => (Math.abs(car.x - vx) < Math.abs(car.x - best) ? vx : best), vRoads[0]);
  const horizontal = Math.abs(Math.cos(car.angle)) >= Math.abs(Math.sin(car.angle));
  const dirX = Math.cos(car.angle) >= 0 ? 1 : -1;
  const dirY = Math.sin(car.angle) >= 0 ? 1 : -1;
  let aimX;
  let aimY;
  if (horizontal) {
    // Next intersection ahead on this road.
    const nextV = vRoads.filter((vx) => (vx - car.x) * dirX > 0).sort((a, b) => Math.abs(a - car.x) - Math.abs(b - car.x))[0];
    const distToCross = nextV === undefined ? Infinity : Math.abs(nextV - car.x);
    if (nextV !== undefined && distToCross < 130) {
      // Choose the turn: straight, or up/down the cross road — whichever
      // lands closest to the target, without reversing or driving into water.
      const options = [
        { x: nextV + dirX * 300, y: onH, ok: true },
        { x: nextV, y: onH - 300, ok: onH - 300 > 40 },
        { x: nextV, y: onH + 300, ok: onH + 300 < 1680 },
      ];
      let best = options[0];
      let bestD = Infinity;
      for (const opt of options) {
        if (!opt.ok) continue;
        const d = Math.hypot(opt.x - tx, opt.y - ty);
        if (d < bestD) { bestD = d; best = opt; }
      }
      aimX = best.x;
      aimY = best.y;
    } else {
      aimX = car.x + dirX * 260;
      aimY = onH;
    }
  } else {
    const nextH = hRoads.filter((hy) => (hy - car.y) * dirY > 0).sort((a, b) => Math.abs(a - car.y) - Math.abs(b - car.y))[0];
    const distToCross = nextH === undefined ? Infinity : Math.abs(nextH - car.y);
    if (nextH !== undefined && distToCross < 130) {
      const options = [
        { x: onV, y: nextH + dirY * 300, ok: nextH + dirY * 300 < 1680 },
        { x: onV - 300, y: nextH, ok: onV - 300 > 40 },
        { x: onV + 300, y: nextH, ok: !(nextH < 760 && onV + 300 > 2340) },
      ];
      let best = options[0];
      let bestD = Infinity;
      for (const opt of options) {
        if (!opt.ok) continue;
        const d = Math.hypot(opt.x - tx, opt.y - ty);
        if (d < bestD) { bestD = d; best = opt; }
      }
      aimX = best.x;
      aimY = best.y;
    } else {
      aimX = onV;
      aimY = car.y + dirY * 260;
    }
  }
  const diff = steerToward(input, car.x, car.y, car.angle, aimX, aimY);
  // A sharp turn at speed ends in a wall: brake for it, then power out.
  if (Math.abs(diff) > 0.6) {
    input.keys.up = false;
    input.keys.down = true;
  } else {
    input.keys.up = true;
    input.keys.down = false;
  }
}

function walkPilot(input, world, tx, ty) {
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) {
    input.keys.up = false;
    input.keys.down = false;
    input.keys.left = false;
    input.keys.right = false;
    return;
  }
  input.keys.up = dy < -20;
  input.keys.down = dy > 20;
  input.keys.left = dx < -20;
  input.keys.right = dx > 20;
  input.keys.run = d > 200;
}

function nearestEnemy(world) {
  let best = null;
  let bestD = Infinity;
  for (const e of world.combat.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - world.player.x, e.y - world.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Play the real rules forward for `seconds`, calling `update` each step so the autopilot can re-aim. */
function forSeconds(world, input, seconds, update) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (update) update();
    world.step(STEP, input);
    // A trace for the play-test harness: where the player was, how the car
    // held up, what the heat was — every half second of the staged scene.
    if (i % 30 === 0 && typeof window !== 'undefined') {
      const trace = window.__shotTrace || (window.__shotTrace = []);
      trace.push({
        t: +(i * STEP).toFixed(1),
        x: Math.round(world.player.x),
        y: Math.round(world.player.y),
        inCar: world.player.inCar,
        carHealth: world.player.car ? Math.round(world.player.car.health) : null,
        speed: Math.round(world.player.moveSpeed),
        wanted: world.police.wanted,
        screen: world.state.screen,
      });
    }
  }
}

/**
 * Set `world` to the named scene and return the mode to draw. The four scenes
 * are the four screenshots: chase (cover), foot, mission, drive.
 */
export function stageShot(name, world) {
  const input = makeShotInput();
  const S = world.stage;
  if (name === 'foot') {
    // On foot downtown, walking toward Sol Plaza through traffic and crowds.
    S.teleport(1010, 990, -Math.PI / 2);
    forSeconds(world, input, 5, () => walkPilot(input, world, PLACES.plaza.x, PLACES.plaza.y));
    return { screen: 'playing' };
  }
  if (name === 'mission') {
    // The dock shootout: mid-stage, gunmen around, the player strafing around
    // the docks and returning fire.
    S.startMission('dockside', 1);
    S.teleport(2220, 560, 0);
    let t = 0;
    forSeconds(world, input, 6, () => {
      t += STEP;
      // Strafe in a slow circle around the docks so the gunmen can't pin Jax.
      const ox = PLACES.docks.x + Math.cos(t * 0.6) * 90;
      const oy = PLACES.docks.y + Math.sin(t * 0.6) * 90;
      walkPilot(input, world, ox, oy);
      const enemy = nearestEnemy(world);
      if (enemy) {
        input.setMouse({
          x: enemy.x - world.camera.x + 640,
          y: enemy.y - world.camera.y + 360,
          down: true,
          seen: true,
        });
      }
    });
    return { screen: 'playing' };
  }
  if (name === 'drive') {
    // A calm cruise east along the beach road: palms, boardwalk, sea.
    S.teleport(300, 1650, 0);
    const car = world.driveCars[3];
    S.placeCar(car, 300, 1650, 0);
    S.enterCar(car);
    S.clearWanted();
    forSeconds(world, input, 4.5, () => roadPilot(input, world, 2400, 1650));
    return { screen: 'playing' };
  }
  // Default and 'chase': the cover — a getaway at three stars, cops closing
  // in, the hideout marker on the HUD and the minimap.
  S.teleport(600, 1250, 0);
  const car = world.driveCars[0];
  S.placeCar(car, 600, 1250, 0);
  S.enterCar(car);
  S.startMission('getaway', 1);
  forSeconds(world, input, 8, () => roadPilot(input, world, PLACES.hideout.x, PLACES.hideout.y));
  return { screen: 'playing' };
}
