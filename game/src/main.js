// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between three screens: title,
// playing and paused, with busted/wasted/story overlays owned by the world.
//
// ?seed=N fixes the city. ?shot=chase|foot|mission|drive (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { generateCity } from './city.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { loadSave, defaultSave, storeSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = generateCity(random);
const audio = createAudio();
// Staged screenshots always start from a fresh save ($150, no jobs done), so
// a screenshot never shows another session's fines or progress.
const save = shot ? defaultSave() : loadSave();
const world = createWorld(random, city, audio, save);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
// Debug hook for play-testing (and the screenshot harness): the live world.
window.__palmera = { world, seed };

// The canvas is 1280 x 720 inside and scales by CSS to fit the window; the
// input needs the scale so the mouse aims in canvas pixels.
function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  const width = Math.floor(VIEW.width * scale);
  const height = Math.floor(VIEW.height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - width) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - height) / 2)}px`;
  input.setScale(VIEW.width / canvas.getBoundingClientRect().width);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Any uncaught error is visible to the screenshot harness instead of silent.
window.addEventListener('error', (event) => {
  window.__gameError = String(event.message || event.error || 'unknown error');
});

// Screen readers (and anyone watching the page's text) hear the screen changes.
function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, 'playing');
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let mode = 'title';
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  // The title screen's backdrop: the city alive behind the panel, the camera
  // drifting over it. The world steps with an input that presses nothing.
  const attractInput = {
    move: () => ({ x: 0, y: 0 }),
    throttle: () => 0,
    steer: () => 0,
    running: () => false,
    punchHeld: () => false,
    mouse: () => ({ x: 0, y: 0, down: false, seen: false }),
    takeActions: () => 0,
  };

  function startGame() {
    audio.unlock();
    audio.musicStart();
    mode = 'playing';
    accumulator = 0;
    announce('Playing. Steal a car, take a job at Moreno Motors, lose the cops.');
  }

  function handleActions() {
    // Peek, don't take: the world takes the same presses a moment later, so
    // E (steal a car), Space (punch), R and T still reach the game.
    const actions = input.peekActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.setMuted(!audio.isMuted());
      save.muted = muted;
      storeSave(save);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && mode === 'title') {
      startGame();
    } else if (actions & ACTION_PAUSE && mode === 'playing') {
      mode = 'paused';
      audio.engineStop();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && mode === 'paused') {
      mode = 'playing';
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (mode === 'title') {
      titleTime += Math.min(accumulator, STEP);
      while (accumulator >= STEP) {
        world.step(STEP, attractInput);
        accumulator -= STEP;
      }
      // Drift the camera over the city for the backdrop.
      world.camera.x = 1300 + Math.cos(titleTime * 0.05) * 420;
      world.camera.y = 950 + Math.sin(titleTime * 0.04) * 260;
      renderer.draw(world, 'title');
    } else if (mode === 'paused') {
      accumulator = 0;
      renderer.draw(world, 'paused');
    } else {
      while (accumulator >= STEP) {
        world.step(STEP, input);
        accumulator -= STEP;
      }
      renderer.draw(world, 'playing');
    }
  }

  // Leaving the tab pauses a running game rather than letting the cops catch Jax unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') {
      mode = 'paused';
      audio.engineStop();
      announce('Paused.');
    }
  });

  announce('Palmera Bay. Click or press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
