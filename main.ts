// Solmar Bay — the entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ (the playable game,
// plain static files a desktop browser loads offline) and screenshots/ (four
// real renders of the game) into the output directory, then writes
// output/dossier.json with the vendored make.fun library, which is the summary
// the judge reads. The output is deterministic: the same repository always
// writes the same bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The directory this file lives in (the repository root). */
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
/** The grader writes to /output; locally MAKEFUN_OUTPUT_DIR stands in for it. */
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scorer's own caps, from the bounty's gate: only the text cap shapes the
 *  bytes; the others refuse an entry the scorer would refuse anyway, so this
 *  program fails in the same places the gate would. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one directory tree into the output, creating the target first. */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
}
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_CAPS));
