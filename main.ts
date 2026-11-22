// Palmera Bay v3 — my gta6-01 entry (Node 22, standard library only). The game is
// this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request),
// and this program hands it in. It copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library. The game itself is an original
// open-world crime game: Jax Moreno comes home to a sun-soaked coastal city,
// steals cars, outruns the Palmera Bay PD at up to five wanted stars — a
// police helicopter circles overhead at five stars, roadblocks seal
// intersections at three — and runs a ten-job story from his sister's garage
// to the Vault, with the Neon Grand Prix against Rico, near-miss bonuses,
// courier streaks, taxi cabs and delivery vans in traffic, shopfronts,
// streetlamps and beach umbrellas across a richer city, gunfights with tough
// crew members, SMG crates, garage repairs, a horn that makes traffic pull
// over, cash to grab, a minimap, a speedometer, synthesized music and sound,
// and a save in localStorage. The four screenshots in screenshots/ are real
// frames of it running (the first by name is the cover). Serve it locally
// with `node serve.ts`, then open http://localhost:8080. Outside the
// grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Palmera Bay checks before the dossier is written: the entrypoint the
// browser loads must be there, and the screenshots must be exactly the four
// real frames shots.json promises (the first by name is the cover). A missing
// file here means the build step, not the judge, should complain first.
if (!existsSync(join(out, 'game', 'index.html'))) throw new Error('game/index.html is missing from the output');
if (!existsSync(join(out, 'game', 'src', 'main.js'))) throw new Error('game/src/main.js is missing from the output');
const shotList = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
if (!Array.isArray(shotList) || shotList.length < 3 || shotList.length > 4) {
  throw new Error(`shots.json must list 3 or 4 screenshots, found ${Array.isArray(shotList) ? shotList.length : 'none'}`);
}
// Two shots with the same name would silently overwrite each other in /output.
const shotNames = new Set(shotList.map((s) => s.name));
if (shotNames.size !== shotList.length) throw new Error('shots.json lists a screenshot name twice');
for (const shot of shotList) {
  const shotPath = join(out, 'screenshots', shot.name);
  if (!existsSync(shotPath)) throw new Error(`screenshot ${shot.name} is missing from the output`);
  if (statSync(shotPath).size > 262144) throw new Error(`screenshot ${shot.name} is over the 256 KiB cap`);
  // A screenshot must really be a JPEG, not a renamed file: the first two
  // bytes of a JPEG are FF D8.
  const head = readFileSync(shotPath).subarray(0, 2);
  if (head[0] !== 0xff || head[1] !== 0xd8) throw new Error(`screenshot ${shot.name} is not a JPEG`);
}
const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
console.log(`Palmera Bay v3: ${gameFiles.length} files under game/, ${shotList.length} screenshots, cover ${shotList[0].name}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
