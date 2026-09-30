const { mouse, Point, Button } = require('@computer-use/nut-js');
const { execSync } = require('child_process');

async function run() {
  console.log('Double clicking at (365, 490)...');
  await mouse.setPosition(new Point(365, 490));
  await mouse.click(Button.LEFT);
  await new Promise(r => setTimeout(r, 100));
  await mouse.click(Button.LEFT);
  await new Promise(r => setTimeout(r, 2000));
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/interactive_capture.ps1 1440 900 runs/screen_after_double_click_desktop.jpg', { stdio: 'inherit' });
}

run().catch(console.error);
