const { spawn } = require('child_process');
const path = require('path');
const p = spawn(path.join(__dirname, '../apps/ui-tars/resources/FastInputServer.exe'));
const outPath = 'C:\\Users\\Aaryan shukla\\OneDrive\\Desktop\\UI-TARS-desktop-main\\scratch\\test_notepad_vis.jpg';
p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));

p.stdin.write(`screenshot ${outPath}\n`);
setTimeout(() => {
  p.stdin.write('exit\n');
  setTimeout(() => process.exit(0), 200);
}, 600);
