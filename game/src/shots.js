// The screenshot scenes behind ?shot=chase|foot|mission|drive|race|vault.
// Each one sets the real world up — teleport the player, put him in a car,
// start a mission mid-stage, raise the wanted level — then plays the real
// rules forward for a fixed number of steps, steered by a simple autopilot
// that follows the roads toward the objective. The frame is what a short
// game really looks like, and the same seed always stages the same frame.

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
 * Exported so the play-test harness can drive the same roads as the shots.
 */
export function roadPilot(input, world, tx, ty) {
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
  // Whether the next intersection is a turn (not straight on), and how far
  // away it is. The turn choice is read from 420 units out — from full speed
  // the car needs ~400 units to slow to a cornering speed — but the aim only
  // swings onto the turn inside 130, so the car holds its line until then.
  let turning = false;
  let distToCross = Infinity;
  if (horizontal) {
    // Next intersection ahead on this road.
    const nextV = vRoads.filter((vx) => (vx - car.x) * dirX > 0).sort((a, b) => Math.abs(a - car.x) - Math.abs(b - car.x))[0];
    distToCross = nextV === undefined ? Infinity : Math.abs(nextV - car.x);
    // Choose the turn: straight, or up/down the cross road — whichever
    // lands closest to the target, without reversing or driving into water.
    const options = nextV === undefined ? null : [
      { x: nextV + dirX * 300, y: onH, ok: true },
      { x: nextV, y: onH - 300, ok: onH - 300 > 40 },
      { x: nextV, y: onH + 300, ok: onH + 300 < 1680 },
    ];
    let best = options ? options[0] : null;
    if (options) {
      let bestD = Infinity;
      for (const opt of options) {
        if (!opt.ok) continue;
        const d = Math.hypot(opt.x - tx, opt.y - ty);
        if (d < bestD) { bestD = d; best = opt; }
      }
      turning = best !== options[0];
    }
    if (nextV !== undefined && distToCross < 130) {
      aimX = best.x;
      aimY = best.y;
    } else {
      aimX = car.x + dirX * 260;
      aimY = onH;
    }
  } else {
    const nextH = hRoads.filter((hy) => (hy - car.y) * dirY > 0).sort((a, b) => Math.abs(a - car.y) - Math.abs(b - car.y))[0];
    distToCross = nextH === undefined ? Infinity : Math.abs(nextH - car.y);
    const options = nextH === undefined ? null : [
      { x: onV, y: nextH + dirY * 300, ok: nextH + dirY * 300 < 1680 },
      { x: onV - 300, y: nextH, ok: onV - 300 > 40 },
      { x: onV + 300, y: nextH, ok: !(nextH < 760 && onV + 300 > 2340) },
    ];
    let best = options ? options[0] : null;
    if (options) {
      let bestD = Infinity;
      for (const opt of options) {
        if (!opt.ok) continue;
        const d = Math.hypot(opt.x - tx, opt.y - ty);
        if (d < bestD) { bestD = d; best = opt; }
      }
      turning = best !== options[0];
    }
    if (nextH !== undefined && distToCross < 130) {
      aimX = best.x;
      aimY = best.y;
    } else {
      aimX = onV;
      aimY = car.y + dirY * 260;
    }
  }
  const diff = steerToward(input, car.x, car.y, car.angle, aimX, aimY);
  // Brake early for a turn, then power out of it; a sharp turn at speed
  // still ends in a wall, so the early brake is what makes corners work.
  // But never brake below a cornering speed: steering authority scales with
  // speed, so a car crawling at 30 cannot turn at all and gets wedged. And
  // once slowed, HOLD that speed through the corner — throttling back up
  // before the heading settles just arrives at the corner too fast again.
  const cornering = turning && distToCross < 420;
  if (cornering || Math.abs(diff) > 0.6) {
    if (car.speed > 220) {
      input.keys.up = false;
      input.keys.down = true;
    } else {
      // At a cornering speed already: coast, so the speed holds through the turn.
      input.keys.up = false;
      input.keys.down = false;
    }
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
 * Set `world` to the named scene and return the mode to draw. The six scenes
 * are the four screenshots: chase (cover), race, vault, drive.
 */
export function stageShot(name, world) {
  const input = makeShotInput();
  const S = world.stage;
  if (name === 'race') {
    // The Neon Grand Prix: the race car and Rico's red rival side by side
    // at Sol Plaza, then both tearing east toward the first checkpoint.
    S.startMission('grandprix', 1);
    S.teleport(1040, 590, 0);
    // The sporty blue car (driveCars[1]): it stands out on the asphalt and
    // its top speed is what makes the race winnable against Rico.
    const raceCar = world.driveCars[1];
    S.placeCar(raceCar, 1040, 590, 0);
    S.enterCar(raceCar);
    // Three seconds: both cars are mid-straight east, still side by side and
    // well inside the camera's reach — five seconds runs them into the east
    // edge, where the clamped camera pushes them off the frame.
    forSeconds(world, input, 3, () => roadPilot(input, world, 2200, 550));
    return { screen: 'playing' };
  }
  if (name === 'vault') {
    // The Vault: five guards around Bay Trust Bank, the player circling
    // on foot and returning fire — the shootout that opens the big heist.
    S.startMission('vault', 1);
    S.teleport(PLACES.bank.x + 60, PLACES.bank.y + 60, 0);
    let t = 0;
    forSeconds(world, input, 4, () => {
      t += STEP;
      const a = t * 5.0;
      const ox = PLACES.bank.x + 60 + Math.cos(a) * 40;
      const oy = PLACES.bank.y + 60 + Math.sin(a) * 40;
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
  if (name === 'foot') {
    // On foot east along the sand, below the boardwalk: sea and umbrellas
    // below, the beach road, the shops and the crowd above.
    S.teleport(500, 1710, -Math.PI / 2);
    forSeconds(world, input, 5, () => walkPilot(input, world, 2300, 1710));
    return { screen: 'playing' };
  }
  if (name === 'mission') {
    // The dock shootout: mid-stage, gunmen around, the player circling fast
    // on the open dockside strip and returning fire. The strip (east of the
    // avenue, north of the cross road, west of the bay) is the only ground
    // near the docks with no traffic on it — the earlier slow arcs kept
    // stalling Jax on the road, where the traffic ran him over.
    S.startMission('dockside', 1);
    S.teleport(2280, 450, 0);
    let t = 0;
    forSeconds(world, input, 4, () => {
      t += STEP;
      const a = t * 5.0;
      const ox = 2300 + Math.cos(a) * 40;
      const oy = 450 + Math.sin(a) * 40;
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
    // A hot run east along the middle road: traffic, five stars, speed.
    S.teleport(300, 900, 0);
    const car = world.driveCars[3];
    S.placeCar(car, 300, 900, 0);
    S.enterCar(car);
    S.clearWanted();
    S.addWanted(2);
    forSeconds(world, input, 4, () => roadPilot(input, world, 2400, 900));
    return { screen: 'playing' };
  }
  // Default and 'chase': the cover — a getaway at FIVE stars, the helicopter
  // overhead, cops closing in, the hideout marker on the HUD and the minimap.
  S.teleport(600, 1250, 0);
  const car = world.driveCars[0];
  S.placeCar(car, 600, 1250, 0);
  S.enterCar(car);
  S.startMission('getaway', 1);
  S.addWanted(2);
  // Four seconds: the car is mid-straight north on the avenue at speed,
  // before the turns and the ramming wear it down.
  forSeconds(world, input, 4, () => roadPilot(input, world, PLACES.hideout.x, PLACES.hideout.y));
  return { screen: 'playing' };
}
