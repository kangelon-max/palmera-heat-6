// PALMERA HEAT IV — make.fun gta6-01 entrypoint (Node, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files a
// desktop browser loads fully offline (game/index.html plus its ES modules —
// a hand-rolled WebGL engine, procedural textures and models, no library, no
// network). This program is the hand-in: it copies game/ and screenshots/
// into the output directory and writes dossier.json there with the vendored
// make.fun library, under the scorer's own caps.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader's container.)

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (reference/gate.json): text_max_bytes shapes the dossier
// bytes; the rest refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 game files or 48 MiB of
// game in all, or a path under game/ over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Every file under dir, as paths relative to dir, sorted by codepoint. */
function listFiles(dir: string, base = dir): string[] {
  const names = readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const files: string[] = [];
  for (const entry of names) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full, base));
    else if (entry.isFile()) files.push(full.slice(base.length + 1));
  }
  return files;
}

/** Pre-flight: refuse to hand in a tree the scorer would refuse. Checked
 *  against the same caps the dossier is built with, before anything is
 *  copied — a breach here is a build bug, not a scoring surprise. */
function validateSources(): void {
  const shots = listFiles(join(here, 'screenshots'));
  if (shots.length === 0) throw new Error('no screenshots to hand in');
  if (shots.length > CAPS.screenshots.max) throw new Error(`too many screenshots: ${shots.length} > ${CAPS.screenshots.max}`);
  for (const rel of shots) {
    const size = statSync(join(here, 'screenshots', rel)).size;
    if (size > CAPS.screenshots.max_bytes) throw new Error(`screenshot ${rel} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
  }
  const game = listFiles(join(here, 'game'));
  if (game.length > CAPS.game_max_files) throw new Error(`too many game files: ${game.length} > ${CAPS.game_max_files}`);
  let bytes = 0;
  for (const rel of game) {
    if (rel.length > CAPS.game_path_max_bytes) throw new Error(`game path too long: ${rel}`);
    bytes += statSync(join(here, 'game', rel)).size;
  }
  if (bytes > CAPS.game_max_bytes) throw new Error(`game tree is ${bytes} bytes, over the ${CAPS.game_max_bytes} cap`);
}

/** Copy a tree afresh: remove any stale output first so two runs of this
 *  program over the same output directory produce byte-identical trees. */
function copyFresh(from: string, to: string): void {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

validateSources();
copyFresh(join(here, 'game'), join(out, 'game'));
copyFresh(join(here, 'screenshots'), join(out, 'screenshots'));

const gameFiles = listFiles(join(out, 'game'));
const shotFiles = listFiles(join(out, 'screenshots'));
const gameBytes = gameFiles.reduce((sum, rel) => sum + statSync(join(out, 'game', rel)).size, 0);
console.log(`palmera-heat-iv: ${gameFiles.length} game files (${gameBytes} bytes), ${shotFiles.length} screenshots: ${shotFiles.join(', ')}`);

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
