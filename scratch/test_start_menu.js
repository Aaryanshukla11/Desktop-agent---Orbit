const { spawn } = require('child_process');
const path = require('path');

const p = spawn(path.join(__dirname, '../apps/ui-tars/resources/FastInputServer.exe'));
p.stdout.on('data', d => console.log('STDOUT:', d.toString()));

// Let's test sending ctrl+esc
console.log('Sending ctrl+esc...');
p.stdin.write('hotkey ctrl esc\n');

setTimeout(() => {
  p.stdin.write('exit\n');
  process.exit(0);
}, 1000);
