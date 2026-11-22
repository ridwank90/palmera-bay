// The world: Jax on foot and in a car, the cars he can steal, the cash lying
// around the city, the camera, and the step that ties every system together —
// input, traffic, police, combat, missions, pickups, particles and sound. The
// world owns the player and the drivable cars; everything else lives in its
// own module and is driven from here through small `ctx` objects.

import { CAR, MONEY, NEAR_MISS, PLAYER, REPAIR, VIEW, WANTED, WEAPONS, WEAPON_CRATES, WORLD } from './config.js';
import { PLACES, pointOnSand, randomRoadPoint, resolveCircle } from './city.js';
import { ACTION_ENTER_CAR, ACTION_HORN, ACTION_JOB, ACTION_PUNCH, ACTION_RELOAD, ACTION_REPAIR } from './input.js';
import { createCombat } from './combat.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createParticles } from './particles.js';
import { createRival } from './rival.js';
import { storeSave } from './save.js';

const PARKED_SPOTS = [
  { x: 640, y: 210, angle: 0 }, { x: 1020, y: 560, angle: Math.PI / 2 }, { x: 1420, y: 910, angle: 0 },
  { x: 620, y: 1260, angle: Math.PI }, { x: 1820, y: 560, angle: Math.PI / 2 }, { x: 1000, y: 1610, angle: 0 },
  { x: 2220, y: 950, angle: -Math.PI / 2 }, { x: 220, y: 900, angle: Math.PI / 2 }, { x: 1410, y: 220, angle: 0 },
  { x: 1820, y: 1260, angle: Math.PI },
];
const PARKED_COLORS = ['#d94f3d', '#3d7ea6', '#e8c547', '#7a9e7e', '#c9c9c9', '#2e4057'];

export function createWorld(random, city, audio, save) {
  const particles = createParticles();
  const combat = createCombat();
  const traffic = createTraffic(random);
  const police = createPolice(random);
  const missions = createMissions(save.missionsDone || []);
  // Rico's race car for the Neon Grand Prix — only on the track when a race runs.
  const rival = createRival(random);
  // Weapon crates: fixed spots around the city, one SMG each, restocked after a while.
  const weaponCrates = [
    { x: PLACES.alley.x, y: PLACES.alley.y, active: true, timer: 0, label: 'Back Alley' },
    { x: PLACES.docks.x, y: PLACES.docks.y + 40, active: true, timer: 0, label: 'Palmera Docks' },
    { x: PLACES.marina.x, y: PLACES.marina.y, active: true, timer: 0, label: 'Marina' },
  ];

  const player = {
    x: PLACES.garage.x + 40,
    y: PLACES.garage.y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.health,
    inCar: false,
    car: null,
    punchTimer: 0,
    shootTimer: 0,
    weapon: 'pistol',
    ammo: WEAPONS.pistol.mag,
    reloading: false,
    reloadTimer: 0,
    shootWantedTimer: 0,
    ramWantedTimer: 0,
    moveSpeed: 0,
  };

  const driveCars = [];
  for (let i = 0; i < 16; i++) {
    driveCars.push({ active: false, x: 0, y: 0, angle: 0, vx: 0, vy: 0, speed: 0, health: CAR.health, color: '#888', sporty: false, wrecked: false, target: false, hitTimer: 0 });
  }

  const pickups = [];
  for (let i = 0; i < 10; i++) pickups.push({ active: false, x: 0, y: 0, amount: MONEY.pickup });

  const camera = { x: player.x, y: player.y };
  const state = {
    money: save.money,
    kills: 0,
    carsStolen: save.carsStolen || 0,
    screen: null, // 'busted' | 'wasted' | 'story'
    screenTimer: 0,
    toast: '',
    toastTimer: 0,
    toastKind: 'info',
    saveTimer: 0,
    time: 0,
    nearMisses: 0,
    // Near-miss bookkeeping: cars already credited this pass, and whether
    // the player was on the sand last step (for the beach splash sound).
    nearMissed: new Set(),
    wasOnSand: false,
  };

  function toast(text, kind = 'info', seconds = 3) {
    state.toast = text;
    state.toastKind = kind;
    state.toastTimer = seconds;
  }

  function spawnParkedCars() {
    for (let i = 0; i < PARKED_SPOTS.length; i++) {
      const spot = PARKED_SPOTS[i];
      const car = driveCars[i];
      car.active = true;
      car.x = spot.x;
      car.y = spot.y;
      car.angle = spot.angle;
      car.vx = 0; car.vy = 0; car.speed = 0;
      car.health = CAR.health;
      car.color = PARKED_COLORS[i % PARKED_COLORS.length];
      car.sporty = i === 1;
      car.wrecked = false;
      car.target = false;
    }
  }

  function spawnPickupNear() {
    const p = pickups.find((q) => !q.active);
    if (!p) return;
    for (let tries = 0; tries < 10; tries++) {
      const pt = randomRoadPoint(random);
      if (Math.hypot(pt.x - player.x, pt.y - player.y) < 200) continue;
      p.x = pt.x + (random() - 0.5) * 30;
      p.y = pt.y + (random() - 0.5) * 30;
      p.active = true;
      return;
    }
  }

  function spawnTargetCar(x, y, sporty) {
    const car = driveCars.find((c) => !c.active) || driveCars.find((c) => !c.target && c !== player.car);
    if (!car) return;
    car.active = true;
    car.x = x + 30;
    car.y = y + 30;
    car.angle = 0;
    car.vx = 0; car.vy = 0; car.speed = 0;
    car.health = CAR.health;
    car.color = sporty ? '#d94f3d' : '#f1faee';
    car.sporty = sporty;
    car.wrecked = false;
    car.target = true;
  }

  function spawnEnemies(x, y, n) {
    // A wave lands in a loose ring around the point, never on top of the player.
    combat.spawnWave(x, y, n);
  }

  /** The garage at Moreno Motors: full repair for $50, car only, key F. */
  function repairCar() {
    const car = player.car;
    if (!car || car.health >= CAR.health) return;
    if (state.money < REPAIR.cost) {
      toast(`Repair costs $${REPAIR.cost} — you are short.`, 'bad', 2.5);
      return;
    }
    addMoney(-REPAIR.cost);
    car.health = CAR.health;
    save.repairsDone = (save.repairsDone || 0) + 1;
    particles.repairBurst(car.x, car.y);
    audio.repair();
    toast(`Repaired at Moreno Motors — $${REPAIR.cost}.`, 'good', 2.5);
    persist();
  }

  /** Weapon crates: walk over one on foot to swap the pistol for an SMG. */
  function stepWeaponCrates(dt) {
    for (const crate of weaponCrates) {
      if (!crate.active) {
        crate.timer -= dt;
        if (crate.timer <= 0) crate.active = true;
        continue;
      }
      if (!player.inCar && Math.hypot(crate.x - player.x, crate.y - player.y) < 34) {
        crate.active = false;
        crate.timer = WEAPON_CRATES.respawn;
        player.weapon = 'smg';
        player.ammo = WEAPONS.smg.mag;
        player.reloading = false;
        save.cratesPickedUp = (save.cratesPickedUp || 0) + 1;
        particles.floatText(crate.x, crate.y - 24, 'SMG PICKED UP', '#f2c94c');
        audio.pickup();
        toast('SMG picked up — 30 rounds, fast fire.', 'good', 3);
        persist();
      }
    }
  }

  function addMoney(amount) {
    state.money += amount;
    save.money = state.money;
    save.bestMoney = Math.max(save.bestMoney || 0, state.money);
  }

  function persist() {
    save.money = state.money;
    save.missionsDone = [...missions.done];
    save.carsStolen = state.carsStolen;
    save.missionsPlayed = missions.done.size;
    save.nearMisses = state.nearMisses || 0;
    save.bestWanted = Math.max(save.bestWanted || 0, police.wanted);
    save.grandPrixWins = save.grandPrixWins || 0;
    save.cratesPickedUp = save.cratesPickedUp || 0;
    save.repairsDone = save.repairsDone || 0;
    save.roadblocksDodged = save.roadblocksDodged || 0;
    storeSave(save);
  }

  function respawnAfterTrouble(kind) {
    player.health = PLAYER.health;
    player.inCar = false;
    player.car = null;
    player.x = PLACES.hospital.x;
    player.y = PLACES.hospital.y + 60;
    player.angle = -Math.PI / 2;
    police.clearWanted();
    combat.clearEnemies();
    const lost = Math.min(state.money, MONEY.bustedFine);
    addMoney(-lost);
    if (kind === 'busted') toast(`BUSTED — Captain Reyes fined you $${lost}.`, 'bad', 4);
    else toast(`WASTED — Lena dragged you to Palmera General. Lost $${lost}.`, 'bad', 4);
    persist();
  }

  function onArrest() {
    if (state.screen) return;
    state.screen = 'busted';
    state.screenTimer = 2.6;
    audio.missionFail();
    if (missions.active) missions.failActive(missionCtx(), 'The cops caught you.');
  }

  function onWasted() {
    if (state.screen) return;
    state.screen = 'wasted';
    state.screenTimer = 2.6;
    audio.missionFail();
    if (missions.active) missions.failActive(missionCtx(), 'You got wasted.');
  }

  function nearestDrivable(x, y, radius) {
    let best = null;
    let bestD = radius;
    for (const car of driveCars) {
      if (!car.active || car.wrecked) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = car; }
    }
    for (const car of traffic.cars) {
      if (!car.active) continue;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = { trafficCar: car }; }
    }
    return best;
  }

  function enterCar(found) {
    let car;
    if (found.trafficCar) {
      const t = found.trafficCar;
      t.active = false;
      car = driveCars.find((c) => !c.active);
      if (!car) return;
      car.active = true;
      car.x = t.x; car.y = t.y; car.angle = t.angle;
      car.vx = 0; car.vy = 0; car.speed = 0;
      car.health = CAR.health;
      car.color = t.color;
      car.sporty = t.sporty;
      car.wrecked = false;
      car.target = false;
    } else {
      car = found;
    }
    player.inCar = true;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    state.carsStolen += 1;
    // The Grand Prix car is an invited race entry, not a theft: no wanted
    // for climbing into it. Every other car is still a stolen car.
    const raceEntry = car.target && missions.active && missions.active.def.id === 'grandprix';
    if (!raceEntry) {
      police.addWanted(WANTED.stealCar);
      particles.floatText(car.x, car.y - 30, 'STOLEN — WANTED +1', '#e5534b');
      toast('Car stolen — the cops are on their way.', 'bad', 2.5);
    } else {
      toast('Race car — beat Rico to the finish line.', 'mission', 3);
    }
    audio.engineStart();
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    player.inCar = false;
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    const pos = { x: player.x, y: player.y };
    resolveCircle(city, pos, PLAYER.radius);
    player.x = pos.x;
    player.y = pos.y;
    audio.engineStop();
  }

  function stepOnFoot(dt, input) {
    const move = input.move();
    const running = input.running();
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    player.moveSpeed = Math.hypot(move.x, move.y) * speed;
    const pos = { x: nx, y: ny };
    resolveCircle(city, pos, PLAYER.radius);
    player.x = pos.x;
    player.y = pos.y;
    if (move.x !== 0 || move.y !== 0) {
      if (!input.mouse().seen) player.angle = Math.atan2(move.y, move.x);
      if (running && Math.random() < dt * 6) particles.dust(player.x, player.y + 8, 1);
    }
    // Aim follows the mouse (in canvas pixels); without a mouse, face the walk.
    const mouse = input.mouse();
    if (mouse.seen) {
      const worldX = camera.x - VIEW.width / 2 + mouse.x;
      const worldY = camera.y - VIEW.height / 2 + mouse.y;
      player.aimAngle = Math.atan2(worldY - player.y, worldX - player.x);
      player.angle = player.aimAngle;
    }
    // Stepping onto the wet sand at the water's edge splashes, once per visit.
    const onSand = pointOnSand(player.x, player.y);
    if (onSand && !state.wasOnSand) {
      audio.splash();
      particles.splash(player.x, player.y + 10, 4);
    }
    state.wasOnSand = onSand;
    // Punch cooldown and the shooting cooldown tick down here.
    player.punchTimer -= dt;
    player.shootTimer -= dt;
    player.shootWantedTimer -= dt;
    if (player.reloading) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        player.reloading = false;
        player.ammo = WEAPONS[player.weapon].mag;
      }
    } else if (mouse.down && player.shootTimer <= 0) {
      if (player.ammo <= 0) {
        player.reloading = true;
        player.reloadTimer = PLAYER.reloadTime;
      } else {
        player.ammo -= 1;
        player.shootTimer = WEAPONS[player.weapon].cooldown;
        const muzzle = combat.fireBullet(player.x, player.y, player.aimAngle, true, WEAPONS[player.weapon].damage);
        if (muzzle) particles.muzzle(muzzle.x, muzzle.y, player.aimAngle);
        audio.gunshot();
        traffic.scare(player.x, player.y, 320);
        if (player.shootWantedTimer <= 0) {
          police.addWanted(WANTED.shoot);
          player.shootWantedTimer = 4;
        }
      }
    }
  }

  function stepDriving(dt, input) {
    const car = player.car;
    if (!car) { player.inCar = false; return; }
    const throttle = input.throttle();
    const steer = input.steer();
    const handbrake = input.punchHeld();
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const forwardSpeed = car.vx * forwardX + car.vy * forwardY;
    const maxSpeed = (car.sporty ? CAR.sportsMaxSpeed : CAR.maxSpeed) * (pointOnSand(car.x, car.y) ? 0.5 : 1);
    // Throttle along the car's nose; brake and reverse on S.
    if (throttle > 0) {
      car.vx += forwardX * CAR.accel * dt;
      car.vy += forwardY * CAR.accel * dt;
    } else if (throttle < 0) {
      if (forwardSpeed > 30) {
        car.vx -= forwardX * CAR.brake * dt;
        car.vy -= forwardY * CAR.brake * dt;
      } else {
        car.vx -= forwardX * CAR.accel * 0.55 * dt;
        car.vy -= forwardY * CAR.accel * 0.55 * dt;
      }
    }
    // Steering: sharper at low speed, and the back steps out on the handbrake.
    const steerAuthority = Math.min(1, Math.abs(forwardSpeed) / 120) * (forwardSpeed < 0 ? -1 : 1);
    car.angle += steer * CAR.steer * steerAuthority * dt * (handbrake ? 1.5 : 1);
    // Grip: kill sideways velocity, less of it on the handbrake.
    const rightX = -forwardY;
    const rightY = forwardX;
    const lateral = car.vx * rightX + car.vy * rightY;
    const grip = handbrake ? CAR.handbrakeGrip : 0.86;
    const keep = Math.pow(1 - grip, dt * 60);
    car.vx -= rightX * lateral * (1 - keep);
    car.vy -= rightY * lateral * (1 - keep);
    // Drag and the speed cap.
    const drag = Math.pow(1 - CAR.drag, dt);
    car.vx *= drag;
    car.vy *= drag;
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > maxSpeed) {
      car.vx = (car.vx / sp) * maxSpeed;
      car.vy = (car.vy / sp) * maxSpeed;
    }
    const nx = car.x + car.vx * dt;
    const ny = car.y + car.vy * dt;
    const pos = { x: nx, y: ny };
    const pushed = resolveCircle(city, pos, 20);
    car.x = pos.x;
    car.y = pos.y;
    if (pushed && sp > 140 && car.hitTimer <= 0) {
      car.hitTimer = 0.8;
      car.health -= Math.min(18, (sp - 140) / 18);
      car.vx *= -0.35;
      car.vy *= -0.35;
      particles.sparks(car.x, car.y, 8);
      audio.crash();
    }
    if (handbrake && sp > 200) {
      particles.skid(car.x - forwardX * 14, car.y - forwardY * 14, car.angle);
      particles.dust(car.x, car.y, 1);
    }
    // Spraying along the sand throws up spray behind the car.
    if (pointOnSand(car.x, car.y) && sp > 260 && Math.random() < dt * 6) {
      particles.splash(car.x - forwardX * 20, car.y - forwardY * 20, 3);
    }
    car.speed = Math.hypot(car.vx, car.vy);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.moveSpeed = car.speed;
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      particles.smoke(car.x, car.y, 14);
      audio.crash();
      toast('Your car is wrecked — get out and find another.', 'bad', 3);
      exitCar();
    }
    audio.engineSet(Math.min(1, car.speed / maxSpeed), throttle > 0 ? 1 : 0);
  }

  function stepCollisions() {
    const px = player.x;
    const py = player.y;
    // Pickups.
    for (const p of pickups) {
      if (!p.active) continue;
      if (Math.hypot(p.x - px, p.y - py) < 34) {
        p.active = false;
        addMoney(p.amount);
        particles.floatText(p.x, p.y - 20, `+$${p.amount}`, '#f2c94c');
        audio.pickup();
        spawnPickupNear();
      }
    }
    if (player.inCar && player.car) {
      const car = player.car;
      // Near miss: threading past a traffic car at speed, just outside the
      // scrape distance, pays a little cash (once per car per pass).
      if (car.speed > NEAR_MISS.minSpeed) {
        for (const t of traffic.cars) {
          if (!t.active) continue;
          const d = Math.hypot(t.x - car.x, t.y - car.y);
          if (d > NEAR_MISS.minGap && d < NEAR_MISS.maxGap && !state.nearMissed.has(t)) {
            state.nearMissed.add(t);
            state.nearMisses += 1;
            addMoney(NEAR_MISS.bonus);
            particles.floatText(car.x, car.y - 30, `NEAR MISS +$${NEAR_MISS.bonus}`, '#f2c94c');
            audio.whoosh();
          }
        }
      }
      for (const t of traffic.cars) if (!t.active) state.nearMissed.delete(t);
      // Traffic cars. A scrape is one hit per cooldown, not one per frame:
      // the push-apart separates the cars, and the damage waits its turn.
      for (const t of traffic.cars) {
        if (!t.active) continue;
        const d = Math.hypot(t.x - car.x, t.y - car.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = (car.x - t.x) / d;
          const ny = (car.y - t.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          t.x -= nx * push;
          t.y -= ny * push;
          const rel = Math.abs(car.speed - t.speed);
          if (rel > 120 && car.hitTimer <= 0) {
            car.hitTimer = 0.8;
            car.health -= rel / 40;
            particles.sparks(car.x, car.y, 6);
            audio.crash();
            car.vx *= 0.6;
            car.vy *= 0.6;
          }
        }
      }
      // Pedestrians in the way.
      for (const ped of traffic.peds) {
        if (!ped.active || ped.downTimer > 0) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 28 && car.speed > 60) {
          ped.downTimer = 3;
          police.addWanted(WANTED.killPed);
          particles.floatText(ped.x, ped.y - 20, 'WANTED +2', '#e5534b');
          audio.crash();
        }
      }
      // Police cars: ramming one is a crime; being rammed by one is not.
      // Damage and wanted share the police car's ram cooldown, so a long
      // scrape is one hit, not sixty.
      for (const pc of police.cars) {
        if (!pc.active) continue;
        const d = Math.hypot(pc.x - car.x, pc.y - car.y);
        if (d < 50 && d > 0.01) {
          const push = (50 - d) / 2;
          const nx = (car.x - pc.x) / d;
          const ny = (car.y - pc.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          pc.x -= nx * push;
          pc.y -= ny * push;
          if (car.speed > 120 && pc.ramTimer <= 0) {
            pc.ramTimer = 1.5;
            car.health -= 4;
            particles.sparks(car.x, car.y, 6);
            audio.crash();
            car.vx *= 0.6;
            car.vy *= 0.6;
            if (car.speed > 200 && player.ramWantedTimer <= 0) {
              player.ramWantedTimer = 3;
              police.addWanted(WANTED.ramPolice);
              particles.floatText(pc.x, pc.y - 30, 'WANTED +1', '#e5534b');
            }
          }
        }
      }
    } else {
      // On foot: a traffic car can knock the player down.
      for (const t of traffic.cars) {
        if (!t.active) continue;
        if (Math.hypot(t.x - px, t.y - py) < 26 && t.speed > 80) {
          player.health -= 15;
          const a = Math.atan2(py - t.y, px - t.x);
          const pos = { x: px + Math.cos(a) * 40, y: py + Math.sin(a) * 40 };
          resolveCircle(city, pos, PLAYER.radius);
          player.x = pos.x;
          player.y = pos.y;
          audio.crash();
          if (player.health <= 0) onWasted();
          break;
        }
      }
    }
  }

  function step(dt, input) {
    state.time += dt;
    player.ramWantedTimer -= dt;
    if (player.car) player.car.hitTimer -= dt;
    if (state.screen) {
      state.screenTimer -= dt;
      particles.step(dt);
      if (state.screenTimer <= 0) {
        const kind = state.screen;
        state.screen = null;
        if (kind === 'busted' || kind === 'wasted') respawnAfterTrouble(kind);
      }
      return;
    }
    const actions = input.takeActions();
    if (actions & ACTION_ENTER_CAR) {
      if (player.inCar) {
        exitCar();
      } else {
        const nearGarage = Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y) < 80;
        if (nearGarage && !missions.active && missions.nextMission()) {
          const def = missions.startNext(missionCtx());
          if (def) {
            toast(`${def.title}: ${def.briefing}`, 'mission', 5);
            audio.click();
          }
        } else {
          const found = nearestDrivable(player.x, player.y, 56);
          if (found) enterCar(found);
        }
      }
    }
    if (actions & ACTION_PUNCH) {
      if (!player.inCar && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        const hits = combat.punch(player.x, player.y, player.angle);
        if (hits > 0) {
          audio.punch();
          particles.sparks(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, 6);
        }
      }
    }
    if (actions & ACTION_RELOAD) {
      if (!player.inCar && !player.reloading && player.ammo < WEAPONS[player.weapon].mag) {
        player.reloading = true;
        player.reloadTimer = PLAYER.reloadTime;
      }
    }
    if (actions & ACTION_REPAIR) {
      // F at the garage, in a car: Moreno Motors patches it up for $50.
      if (player.inCar && player.car && Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y) < REPAIR.radius) {
        repairCar();
      }
    }
    if (actions & ACTION_JOB) {
      if (!missions.active && !missions.courier) {
        const job = missions.startCourier(missionCtx());
        if (job) {
          toast(`Courier job: pick up ${job.packageLabel}, then deliver it.`, 'mission', 4);
          audio.click();
        }
      }
    }
    let honk = false;
    if (actions & ACTION_HORN) {
      // H (horn): a honk that scatters the crowd and makes the car ahead pull over.
      honk = true;
      audio.horn();
      traffic.scare(player.x, player.y, 220);
    }

    if (player.inCar) stepDriving(dt, input);
    else stepOnFoot(dt, input);

    traffic.step(dt, {
      playerX: player.x, playerY: player.y,
      playerInCar: player.inCar, playerCar: player.car, playerSpeed: player.moveSpeed, city,
      playerAngle: player.angle, honk,
    });

    // Rico races the same loop: his car only moves while a race runs.
    rival.step(dt, city);

    // Slipping past a roadblock counts: the PD sealed the road and lost you.
    if (police.roadblock.active) {
      const rb = police.roadblock;
      if (!state.roadblockDodged && Math.hypot(player.x - rb.x, player.y - rb.y) < 70) {
        state.roadblockDodged = true;
        save.roadblocksDodged = (save.roadblocksDodged || 0) + 1;
        particles.floatText(player.x, player.y - 30, 'ROADBLOCK DODGED', '#7fe39a');
        toast('Roadblock dodged — the PD lost you.', 'good', 2.5);
        persist();
      }
    } else {
      state.roadblockDodged = false;
    }

    police.step(dt, {
      playerX: player.x, playerY: player.y,
      playerInCar: player.inCar, playerCar: player.car, city,
      playerAngle: player.angle,
      onArrest,
      onRam: (damage) => {
        if (player.car) {
          player.car.health -= damage;
          particles.sparks(player.car.x, player.car.y, 8);
          audio.crash();
        }
      },
    });

    combat.step(dt, {
      player: { x: player.x, y: player.y },
      playerInCar: player.inCar,
      playerCar: player.car,
      city, random,
      onPlayerDamage: (amount) => {
        player.health -= amount;
        if (player.health <= 0) onWasted();
      },
      onCarDamage: (amount) => {
        if (player.car) {
          player.car.health -= amount;
          particles.sparks(player.car.x, player.car.y, 4);
        }
      },
      onEnemyKilled: (x, y) => {
        state.kills += 1;
        particles.floatText(x, y - 20, 'CREW DOWN', '#e5534b');
      },
      onEnemyShot: (x, y, angle) => {
        particles.muzzle(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, angle);
      },
    });

    missions.step(dt, missionCtx());

    stepCollisions();
    stepWeaponCrates(dt);

    // Camera follows the player, clamped to the city.
    const tx = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, player.x));
    const ty = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, player.y));
    camera.x += (tx - camera.x) * Math.min(1, dt * 5);
    camera.y += (ty - camera.y) * Math.min(1, dt * 5);

    particles.step(dt);
    audio.sirenTick(dt);
    const nearestPolice = police.nearestDistance(player.x, player.y);
    audio.sirenSet(nearestPolice);

    if (state.toastTimer > 0) state.toastTimer -= dt;
    state.saveTimer -= dt;
    if (state.saveTimer <= 0) {
      state.saveTimer = 5;
      persist();
    }
  }

  function missionCtx() {
    return {
      playerX: player.x,
      playerY: player.y,
      playerInCar: player.inCar,
      playerCar: player.car,
      inTargetCar: !!(player.inCar && player.car && player.car.target),
      kills: state.kills,
      addWanted: (n) => police.addWanted(n),
      spawnTargetCar,
      spawnEnemies,
      aliveEnemies: () => combat.aliveEnemies(),
      // The Grand Prix: Rico starts beside the player and races the same loop.
      spawnRival: (checkpoints) => {
        rival.stop();
        const start = { x: PLACES.plaza.x - 70, y: PLACES.plaza.y - 30, angle: 0 };
        rival.start(start.x, start.y, start.angle, checkpoints);
      },
      rivalFinished: () => rival.rival.finished,
      onCheckpoint: (n, total) => {
        audio.checkpoint();
        particles.floatText(player.x, player.y - 30, `CHECKPOINT ${n}/${total}`, '#f2c94c');
      },
      randomRoadPoint: () => randomRoadPoint(random),
      randomPlace: () => {
        const keys = Object.keys(PLACES);
        const place = PLACES[keys[Math.floor(random() * keys.length)]];
        return { x: place.x, y: place.y, label: place.label };
      },
      onMissionComplete: (def) => {
        addMoney(def.reward);
        if (def.id === 'grandprix') save.grandPrixWins = (save.grandPrixWins || 0) + 1;
        rival.stop();
        audio.missionDone();
        audio.cash();
        particles.confetti(player.x, player.y, 24);
        particles.floatText(player.x, player.y - 30, `+$${def.reward}`, '#f2c94c');
        toast(`Job complete: ${def.title} — +$${def.reward}`, 'good', 4);
        persist();
        if (missions.allDone) {
          state.screen = 'story';
          state.screenTimer = 4;
        }
      },
      onMissionFailed: (title, reason) => {
        rival.stop();
        audio.missionFail();
        toast(`Job failed: ${title} — ${reason}`, 'bad', 4);
        persist();
      },
      onCourierComplete: (reward) => {
        addMoney(reward);
        audio.cash();
        particles.floatText(player.x, player.y - 30, `+$${reward}`, '#f2c94c');
        toast(`Courier done — +$${reward}`, 'good', 3);
        persist();
      },
      onCourierPickup: () => {
        audio.pickup();
        toast('Package picked up — deliver it before the timer runs out.', 'mission', 3);
      },
      onCourierFailed: () => {
        toast('Courier job failed — the customer gave up waiting.', 'bad', 3);
      },
    };
  }

  // Staging hooks for the screenshot driver (shots.js): teleport the player,
  // place and enter a car, start one mission at a given stage, set the heat.
  // The real game never calls these; they exist so a screenshot can show a
  // chase, a shootout or a beach drive exactly as a player would see it.
  const stage = {
    teleport(x, y, angle = -Math.PI / 2) {
      if (player.inCar) exitCar();
      player.x = x;
      player.y = y;
      player.angle = angle;
      player.aimAngle = angle;
      camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, x));
      camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, y));
    },
    placeCar(car, x, y, angle) {
      car.active = true;
      car.x = x;
      car.y = y;
      car.angle = angle;
      car.vx = 0;
      car.vy = 0;
      car.speed = 0;
      car.health = CAR.health;
      car.wrecked = false;
    },
    enterCar(car) {
      enterCar(car);
    },
    startMission(id, stageIndex = 0) {
      const def = missions.missionList.find((m) => m.id === id);
      if (!def) return false;
      return missions.startSpecific(def, missionCtx(), stageIndex);
    },
    addWanted(n) {
      police.addWanted(n);
    },
    clearWanted() {
      police.clearWanted();
    },
  };

  // Boot: the streets are already busy and the cash is already lying around.
  spawnParkedCars();
  traffic.populate(player.x, player.y);
  for (let i = 0; i < pickups.length; i++) spawnPickupNear();
  audio.setMuted(!!save.muted);

  return {
    player, driveCars, pickups, camera, state, particles, combat, traffic, police, missions, city,
    rival, weaponCrates,
    step, toast, persist, stage,
    get objective() { return missions.objective(); },
    get save() { return save; },
  };
}
