// Rico's race car for the Neon Grand Prix: a rival driver who follows the
// road grid toward the next checkpoint, picks the turn at each intersection
// that gets closest to it, and brakes for sharp corners. Same roads as the
// traffic, but faster and single-minded — beatable only by driving well.

import { RIVAL } from './config.js';
import { ROADS } from './config.js';
import { resolveCircle } from './city.js';
import { clamp } from './random.js';

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createRival(random) {
  const rival = {
    active: false,
    finished: false,
    x: 0, y: 0, angle: 0, speed: 0,
    waypoints: [],
    index: 0,
    color: '#e5534b',
    sporty: true,
  };

  /** Put Rico on the start line, chasing the given checkpoints in order. */
  function start(x, y, angle, waypoints) {
    rival.active = true;
    rival.finished = false;
    rival.x = x;
    rival.y = y;
    rival.angle = angle;
    rival.speed = 0;
    rival.waypoints = waypoints;
    rival.index = 0;
  }

  function stop() {
    rival.active = false;
    rival.finished = false;
    rival.index = 0;
  }

  /**
   * Where the rival is aiming right now: along its current road to the next
   * intersection, and there the turn (straight, left or right) that lands
   * closest to the target checkpoint. Never a U-turn, never into the bay.
   */
  function aimPoint(tx, ty) {
    const hRoads = ROADS.horizontal;
    const vRoads = ROADS.vertical;
    const onH = hRoads.reduce((best, hy) => (Math.abs(rival.y - hy) < Math.abs(rival.y - best) ? hy : best), hRoads[0]);
    const onV = vRoads.reduce((best, vx) => (Math.abs(rival.x - vx) < Math.abs(rival.x - best) ? vx : best), vRoads[0]);
    const horizontal = Math.abs(Math.cos(rival.angle)) >= Math.abs(Math.sin(rival.angle));
    const dirX = Math.cos(rival.angle) >= 0 ? 1 : -1;
    const dirY = Math.sin(rival.angle) >= 0 ? 1 : -1;
    if (horizontal) {
      const nextV = vRoads.filter((vx) => (vx - rival.x) * dirX > 0)
        .sort((a, b) => Math.abs(a - rival.x) - Math.abs(b - rival.x))[0];
      if (nextV !== undefined && Math.abs(nextV - rival.x) < 130) {
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
        return best;
      }
      if (nextV !== undefined) return { x: rival.x + dirX * 260, y: onH };
      // Dead end ahead — the road ends at the bay. Turn back to the nearest
      // cross street instead of driving into the wall forever.
      const backV = vRoads.reduce((best, vx) => (Math.abs(vx - rival.x) < Math.abs(best - rival.x) ? vx : best), vRoads[0]);
      return { x: backV, y: onH };
    }
    const nextH = hRoads.filter((hy) => (hy - rival.y) * dirY > 0)
      .sort((a, b) => Math.abs(a - rival.y) - Math.abs(b - rival.y))[0];
    if (nextH !== undefined && Math.abs(nextH - rival.y) < 130) {
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
      return best;
    }
    if (nextH !== undefined) return { x: onV, y: rival.y + dirY * 260 };
    // Dead end ahead — the road ends at the beach. Turn back to the nearest
    // cross street instead of driving into the sand forever.
    const backH = hRoads.reduce((best, hy) => (Math.abs(hy - rival.y) < Math.abs(best - rival.y) ? hy : best), hRoads[0]);
    return { x: onV, y: backH };
  }

  function step(dt, city) {
    if (!rival.active || rival.finished) return;
    const target = rival.waypoints[rival.index];
    if (!target) {
      rival.finished = true;
      return;
    }
    // Reached this checkpoint: move on to the next.
    if (Math.hypot(target.x - rival.x, target.y - rival.y) < RIVAL.chaseRange) {
      rival.index += 1;
      if (rival.index >= rival.waypoints.length) {
        rival.finished = true;
        return;
      }
    }
    const aim = aimPoint(rival.waypoints[rival.index].x, rival.waypoints[rival.index].y);
    const want = Math.atan2(aim.y - rival.y, aim.x - rival.x);
    const diff = normalizeAngle(want - rival.angle);
    const steer = clamp(diff * 2.2, -1, 1);
    // Brake for a sharp turn, then power out of it. The checkpoint itself
    // being far off-heading means a big turn is coming: slow for it early,
    // or the turn radius carries him past the intersection. And slow to a
    // cornering speed near each checkpoint — the checkpoints ARE the corners.
    const toTarget = Math.atan2(rival.waypoints[rival.index].y - rival.y, rival.waypoints[rival.index].x - rival.x);
    const targetDiff = Math.abs(normalizeAngle(toTarget - rival.angle));
    const distToTarget = Math.hypot(rival.waypoints[rival.index].x - rival.x, rival.waypoints[rival.index].y - rival.y);
    const sharp = Math.abs(diff) > 0.6 || (targetDiff > 0.9 && rival.speed > 260);
    const speedCap = distToTarget < 250 ? 220 : RIVAL.maxSpeed;
    // A U-turn needs rolling speed: steering authority scales with speed,
    // so a stopped car facing the wrong way can never turn around.
    const minSpeed = Math.abs(diff) > 2.5 ? 80 : 0;
    rival.speed = clamp(rival.speed + (sharp ? -420 : RIVAL.accel) * dt, minSpeed, speedCap);
    rival.angle += steer * 2.35 * Math.min(1, rival.speed / 120) * dt;
    rival.x += Math.cos(rival.angle) * rival.speed * dt;
    rival.y += Math.sin(rival.angle) * rival.speed * dt;
    const pos = { x: rival.x, y: rival.y };
    if (resolveCircle(city, pos, 20)) {
      rival.x = pos.x;
      rival.y = pos.y;
      rival.speed *= 0.5;
    } else {
      rival.x = pos.x;
      rival.y = pos.y;
    }
  }

  return { rival, start, stop, step };
}
