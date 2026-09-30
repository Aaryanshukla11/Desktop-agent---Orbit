const fs = require('fs');
const path = require('path');

const dirsToCheck = [
  'apps/ui-tars/node_modules/@common',
  'apps/ui-tars/node_modules/@ui-tars',
  'node_modules/@common',
  'node_modules/@ui-tars',
  'node_modules/@UI-TARs'
];

for (const d of dirsToCheck) {
  const dir = path.resolve(d);
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${d}`);
    continue;
  }
  console.log(`\nChecking ${d}:`);
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.lstatSync(full);
      const link = stat.isSymbolicLink() ? fs.readlinkSync(full) : 'not a symlink';
      const targetExists = fs.existsSync(full);
      console.log(`  ${entry}: isSymlink=${stat.isSymbolicLink()}, targetExists=${targetExists}, link=${link}`);
    } catch (e) {
      console.log(`  ${entry}: error ${e.message}`);
    }
  }
}
