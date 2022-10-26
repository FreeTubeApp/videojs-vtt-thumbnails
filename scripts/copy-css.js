import { copyFileSync, existsSync, mkdirSync, watchFile } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url))

function copy() {
  if (!existsSync(`${__dirname}/../dist/`)) {
    mkdirSync(`${__dirname}/../dist/`, { recursive: true });
  }
  copyFileSync(`${__dirname}/../src/plugin.css`, `${__dirname}/../dist/videojs-vtt-thumbnails.css`);
}

copy();

if (process.argv[1] === '--watch') {
  watchFile(`${__dirname}/../src/plugin.css`, { persistent: true }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      copy();
    }
  });
}
