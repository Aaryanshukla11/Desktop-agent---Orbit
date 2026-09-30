const ln = require('@computer-use/libnut-win32');
const { execSync } = require('child_process');

console.log('Clicking taskbar Notepad icon at (710, 880)...');
ln.moveMouse(710, 880);
ln.mouseClick('left');

setTimeout(() => {
  console.log('Also trying physical coords (1420, 1760)...');
  ln.moveMouse(1420, 1760);
  ln.mouseClick('left');

  setTimeout(() => {
    execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/interactive_capture.ps1 1440 900 runs/screen_after_taskbar_click.jpg', { stdio: 'inherit' });
  }, 2000);
}, 2000);
