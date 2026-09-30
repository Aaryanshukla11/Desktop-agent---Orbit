const { screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const exe = path.resolve(__dirname, '../apps/ui-tars/resources/FastInputServer.exe');
const proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'] });

proc.stdout.on('data', (d) => {
  const msg = d.toString().trim();
  console.log('FastInputServer says:', msg);
  if (msg.includes('READY')) {
    console.log('Sending move 720 450...');
    proc.stdin.write('move 720 450\n');
  } else if (msg.includes('OK')) {
    console.log('Move succeeded!');
    setTimeout(() => {
      proc.kill();
      process.exit(0);
    }, 500);
  }
});
