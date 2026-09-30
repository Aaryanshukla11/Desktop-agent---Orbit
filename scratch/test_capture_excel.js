const { spawn } = require('child_process');
const fs = require('fs');

const p = spawn('scripts/FastInputServer.exe');
p.stdout.on('data', d => {
  const s = d.toString();
  if (s.includes('READY')) {
    p.stdin.write('screenshot scratch/excel_boot_view.jpg\n');
    p.stdout.once('data', d2 => {
      console.log('Captured:', d2.toString().trim());
      process.exit(0);
    });
  }
});
