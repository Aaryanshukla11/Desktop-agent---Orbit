const { keyboard, Key } = require('@computer-use/nut-js');
const { execSync } = require('child_process');
const fs = require('fs');

async function main() {
  console.log('Sending Win+R via keyTap...');
  await keyboard.type(Key.R, [Key.LeftSuper]);
  await new Promise(r => setTimeout(r, 1500));

  const b64 = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scripts/interactive_capture.ps1 1440 900', {
    maxBuffer: 50 * 1024 * 1024,
  }).toString().trim();
  fs.writeFileSync('runs/check_key_tap_win_r.jpg', Buffer.from(b64, 'base64'));
  console.log('Saved to runs/check_key_tap_win_r.jpg');
}

main().catch(console.error);
