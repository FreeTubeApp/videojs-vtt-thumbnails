const { copyFileSync, existsSync, mkdirSync, watchFile } = require('node:fs');

/**
 * Copies plugin.css to the dist folders
 */
function copy() {
  if (!existsSync(`${__dirname}/../dist/`)) {
    mkdirSync(`${__dirname}/../dist/`, { recursive: true });
  }
  copyFileSync(`${__dirname}/../src/plugin.css`, `${__dirname}/../dist/videojs-vtt-thumbnails.css`);
}

copy();

if (process.argv[1] === '--watch') {
  watchFile(`${__dirname}/../src/plugin.css`, { persistent: true }, (current, previous) => {
    if (current.mtimeMs !== previous.mtimeMs) {
      copy();
    }
  });
}
