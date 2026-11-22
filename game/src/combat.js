// Combat: the bullet pool, the punch, and the Cortez crew gunmen who shoot
// back. Bullets fly straight and die on buildings or on what they hit; the
// gunmen strafe and fire at the player when he is close, and shoot at his car
// when he is driving. This module knows nothing about screens or keys — the
// world hands it the player's position and takes back damage and kills.

import { PLAYER } from './config.js';
import { buildingHit } from './city.js';

const BULLET_POOL = 48;
const ENEMY_POOL = 12;

export function createCombat() {
  const bullets = [];
  for (let i = 0; i < BULLET_POOL; i++) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0, fromPlayer: true, life: 0 });
  }
  const enemies = [];
  for (let i = 0; i < ENEMY_POOL; i++) {
    enemies.push({ active: false, x: 0, y: 0, health: 0, maxHealth: 3, tough: false, angle: 0, shootTimer: 0, strafeDir: 1, strafeTimer: 0 });
  }

  function freeBullet() {
    for (const b of bullets) if (!b.active) return b;
    return null;
  }

  function freeEnemy() {
    for (const e of enemies) if (!e.active) return e;
    return null;
  }

  /** Fire one bullet from (x, y) along `angle`. Returns its muzzle point. */
  function fireBullet(x, y, angle, fromPlayer, damage = PLAYER.bulletDamage) {
    const b = freeBullet();
    if (!b) return null;
    b.active = true;
    b.x = x + Math.cos(angle) * 20;
    b.y = y + Math.sin(angle) * 20;
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    b.damage = damage;
    b.fromPlayer = fromPlayer;
    b.life = 1.1;
    return { x: b.x, y: b.y };
  }

  function spawnEnemy(x, y) {
    const e = freeEnemy();
    if (!e) return null;
    e.active = true;
    e.x = x;
    e.y = y;
    // One in four gunmen is a tough one: more health, a bigger frame.
    e.tough = Math.random() < 0.25;
    e.maxHealth = e.tough ? 5 : 3;
    e.health = e.maxHealth;
    e.angle = 0;
    e.shootTimer = 0.6 + Math.random() * 0.8;
    e.strafeDir = Math.random() < 0.5 ? -1 : 1;
    e.strafeTimer = 0;
    return e;
  }

  /**
   * A wave of gunmen around (x, y) for a hold-the-line stage: they land in a
   * loose ring, never on top of the player, and the last one in is the tough one.
   */
  function spawnWave(x, y, n) {
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random() * 0.8;
      const r = 120 + Math.random() * 90;
      const e = spawnEnemy(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (!e) break;
      spawned += 1;
    }
    return spawned;
  }

  function clearEnemies() {
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
  }

  function aliveEnemies() {
    let n = 0;
    for (const e of enemies) if (e.active) n++;
    return n;
  }

  /**
   * A punch from (x, y) facing `angle`: hits every enemy within range and a
   * wide arc in front. Returns how many it hit.
   */
  function punch(x, y, angle, range = PLAYER.punchRange) {
    let hits = 0;
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d > range + 14) continue;
      const toTarget = Math.atan2(dy, dx);
      let diff = toTarget - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.1) continue;
      e.health -= 1;
      hits++;
      if (e.health <= 0) e.active = false;
    }
    return hits;
  }

  /**
   * One step. `ctx` carries the player, the city, the random stream and the
   * callbacks the world wants: onPlayerDamage(amount), onCarDamage(amount),
   * onEnemyKilled(x, y). Returns the kills this step.
   */
  function step(dt, ctx) {
    let kills = 0;
    const px = ctx.player.x;
    const py = ctx.player.y;
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);
      // Strafe sideways and keep a shooting distance; close in slowly.
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeTimer = 0.8 + ctx.random() * 0.8;
        e.strafeDir = ctx.random() < 0.5 ? -1 : 1;
      }
      const want = dist > 320 ? 1 : dist < 180 ? -0.4 : 0;
      const mx = (dx / dist) * want * 130 + (-dy / dist) * e.strafeDir * 110;
      const my = (dy / dist) * want * 130 + (dx / dist) * e.strafeDir * 110;
      e.x += mx * dt;
      e.y += my * dt;
      if (buildingHit(ctx.city.buildings, e.x, e.y, 12)) {
        e.x -= mx * dt;
        e.y -= my * dt;
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 460) {
        e.shootTimer = 0.9 + ctx.random() * 0.7;
        const spread = (ctx.random() - 0.5) * 0.24;
        fireBullet(e.x, e.y, e.angle + spread, false, 8);
        if (ctx.onEnemyShot) ctx.onEnemyShot(e.x, e.y, e.angle);
      }
    }
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || buildingHit(ctx.city.buildings, b.x, b.y, 2)) {
        b.active = false;
        continue;
      }
      if (b.fromPlayer) {
        for (const e of enemies) {
          if (!e.active) continue;
          if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
            e.health -= 1;
            b.active = false;
            if (e.health <= 0) {
              e.active = false;
              kills++;
              if (ctx.onEnemyKilled) ctx.onEnemyKilled(e.x, e.y);
            }
            break;
          }
        }
      } else if (ctx.playerInCar) {
        const car = ctx.playerCar;
        if (car && Math.abs(b.x - car.x) < 26 && Math.abs(b.y - car.y) < 26) {
          b.active = false;
          if (ctx.onCarDamage) ctx.onCarDamage(b.damage);
        }
      } else if (Math.hypot(px - b.x, py - b.y) < PLAYER.radius) {
        b.active = false;
        if (ctx.onPlayerDamage) ctx.onPlayerDamage(b.damage);
      }
    }
    return kills;
  }

  return { bullets, enemies, fireBullet, spawnEnemy, spawnWave, clearEnemies, aliveEnemies, punch, step };
}
