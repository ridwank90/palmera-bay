// Keyboard and mouse input for Palmera Bay. Held keys steer the player and
// the car; one-shot presses (enter a car, punch, reload, pause, take a job)
// are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims: its position
// over the canvas gives the aim direction, and a held click shoots.

export const ACTION_ENTER_CAR = 1;
export const ACTION_PUNCH = 2;
export const ACTION_RELOAD = 4;
export const ACTION_PAUSE = 8;
export const ACTION_CONFIRM = 16;
export const ACTION_MUTE = 32;
export const ACTION_JOB = 64;
export const ACTION_HORN = 128;

import { KEYS } from './config.js';

function setOf(names) {
  const out = new Set();
  for (const group of names) for (const code of KEYS[group]) out.add(code);
  return out;
}

const UP = setOf(['up']);
const DOWN = setOf(['down']);
const LEFT = setOf(['left']);
const RIGHT = setOf(['right']);
const RUN = setOf(['run']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;
  // CSS pixels to canvas pixels: the canvas is 1280 x 720 inside and scaled
  // by CSS to fit the window, so the mouse needs this factor to aim true.
  let scale = 1;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
      return;
    }
    held.add(event.code);
    // Each key sets every flag it means: Space is both a punch and a confirm,
    // so the title screen starts on Space and the game punches on Space.
    if (KEYS.enterCar.includes(event.code)) actions |= ACTION_ENTER_CAR;
    if (KEYS.punch.includes(event.code)) actions |= ACTION_PUNCH;
    if (KEYS.reload.includes(event.code)) actions |= ACTION_RELOAD;
    if (KEYS.pause.includes(event.code)) actions |= ACTION_PAUSE;
    if (KEYS.confirm.includes(event.code)) actions |= ACTION_CONFIRM;
    if (KEYS.mute.includes(event.code)) actions |= ACTION_MUTE;
    if (KEYS.job.includes(event.code)) actions |= ACTION_JOB;
    if (KEYS.horn.includes(event.code)) actions |= ACTION_HORN;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || KEYS.punch.includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  // Right-click does nothing in the game (no menu over the canvas).
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function has(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Set when the canvas is resized: canvas pixels per CSS pixel. */
    setScale(value) {
      scale = value > 0 ? value : 1;
    },
    /** Movement vector from held keys, -1..1 on each axis (normalised). */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Up/down for driving: throttle and brake/reverse, -1..1. */
    throttle() {
      return (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
    },
    /** Left/right for driving: -1..1. */
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    running() {
      return has(RUN);
    },
    /** Whether Space (punch / handbrake) is held. */
    punchHeld() {
      return has(KEYS.punch);
    },
    /** Mouse position in canvas pixels over the canvas, and whether it moved yet. */
    mouse() {
      return { x: mouseX * scale, y: mouseY * scale, down: mouseDown, seen: mouseSeen };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pending one-shot presses without consuming them (the loop peeks
     * at pause/mute/confirm before the world takes the rest). */
    peekActions() {
      return actions;
    },
  };
}
