const { spawn } = require('child_process');
const path = require('path');
const { app, screen } = require('electron');

// We will test if SetCursorPos moves to center with 1440x900 or 720x450
const exe = path.resolve(__dirname, '../apps/ui-tars/resources/FastInputServer.exe');
const proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'] });

proc.stdout.on('data', (d) => {
  const msg = d.toString().trim();
  console.log('OUTPUT:', msg);
  if (msg.includes('READY')) {
    // Try move to center
    proc.stdin.write('move 1440 900\n');
  } else if (msg.includes('OK')) {
    console.log('Moved to 1440 900');
    setTimeout(() => {
      proc.kill();
      process.exit(0);
    }, 200);
  }
});
