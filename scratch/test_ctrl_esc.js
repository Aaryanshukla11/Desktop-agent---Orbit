const { keyboard, Key } = require('@computer-use/nut-js');
const { execSync } = require('child_process');
const fs = require('fs');

async function main() {
  console.log('Testing Ctrl+Esc sequentially...');
  await keyboard.pressKey(Key.LeftControl);
  await keyboard.pressKey(Key.Escape);
  await new Promise(r => setTimeout(r, 100));
  await keyboard.releaseKey(Key.Escape);
  await keyboard.releaseKey(Key.LeftControl);
  console.log('Released Ctrl+Esc sequentially, waiting 1s...');
  await new Promise(r => setTimeout(r, 1000));

  const b64 = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/interactive_capture.ps1 1440 900', {
    maxBuffer: 50 * 1024 * 1024,
  }).toString().trim();
  fs.writeFileSync('runs/check_ctrl_esc.jpg', Buffer.from(b64, 'base64'));
  console.log('Captured screenshot to runs/check_ctrl_esc.jpg');
}

main().catch(console.error);
