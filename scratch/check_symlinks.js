const fs = require('fs');
const path = require('path');

const dir = path.resolve('apps/ui-tars/node_modules/@ui-tars');
console.log('Exists:', fs.existsSync(dir));
const entries = fs.readdirSync(dir);
for (const entry of entries) {
  const full = path.join(dir, entry);
  try {
    const stat = fs.lstatSync(full);
    const link = stat.isSymbolicLink() ? fs.readlinkSync(full) : 'not a symlink';
    const targetExists = fs.existsSync(full);
    console.log(entry, { isSymlink: stat.isSymbolicLink(), link, targetExists });
  } catch (e) {
    console.log(entry, 'Error:', e.message);
  }
}
