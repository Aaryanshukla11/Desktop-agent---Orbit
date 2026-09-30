const { spawn } = require('child_process');
const path = require('path');

const p = spawn(path.join(__dirname, '../apps/ui-tars/resources/FastInputServer.exe'));
p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));

console.log('Sending activate notepad...');
p.stdin.write('activate notepad\n');

setTimeout(() => {
  p.stdin.write('exit\n');
  setTimeout(() => process.exit(0), 300);
}, 2000);
