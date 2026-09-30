const { mouse, Point } = require('@computer-use/nut-js');
const { execSync } = require('child_process');

async function run() {
  console.log('Moving mouse to (720, 895)...');
  await mouse.setPosition(new Point(720, 895));
  await new Promise(r => setTimeout(r, 1000));
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/interactive_capture.ps1 1440 900 runs/screen_after_taskbar_hover.jpg', { stdio: 'inherit' });
}

run().catch(console.error);
