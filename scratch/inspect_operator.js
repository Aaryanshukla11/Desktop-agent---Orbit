const fs = require('fs');
const content = fs.readFileSync('apps/ui-tars/dist/main/main.js', 'utf8');
const search = 'action_type === "hotkey"';
const pos = content.indexOf(search);
if (pos !== -1) {
  console.log('=== FOUND HOTKEY BLOCK ===');
  console.log(content.slice(pos - 150, pos + 1000));
} else {
  console.log('Not found');
}
