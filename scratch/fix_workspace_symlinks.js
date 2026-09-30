const fs = require('fs');
const path = require('path');

const OLD_ROOT = 'C:\\Users\\Aaryan shukla\\OneDrive\\Desktop\\UI-TARS-desktop-main';
const NEW_ROOT = 'c:\\Users\\Aaryan shukla\\OneDrive\\Desktop\\Orbit Beta';

function fixSymlinksInDir(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    try {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        const target = fs.readlinkSync(fullPath);
        if (target.toLowerCase().includes('ui-tars-desktop-main')) {
          const newTarget = target.replace(new RegExp(OLD_ROOT.replace(/\\/g, '\\\\'), 'gi'), NEW_ROOT);
          console.log(`Fixing symlink: ${fullPath}\n  Old: ${target}\n  New: ${newTarget}`);
          fs.unlinkSync(fullPath);
          fs.symlinkSync(newTarget, fullPath, 'junction');
          console.log(`  Target exists now: ${fs.existsSync(fullPath)}`);
        }
      } else if (lstat.isDirectory()) {
        // Don't recurse into .git or deep .pnpm virtual store unless needed
        if (entry === '.git') continue;
        if (entry === '.pnpm' && dirPath.includes('node_modules')) continue;
        fixSymlinksInDir(fullPath);
      }
    } catch (err) {
      // ignore
    }
  }
}

console.log('Searching and fixing broken workspace symlinks...');
fixSymlinksInDir(NEW_ROOT);
console.log('Done scanning and fixing symlinks!');
