const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'interactive_capture.ps1');
console.time('capture');
const b64 = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" 1440 900`, {
  maxBuffer: 50 * 1024 * 1024,
}).toString().trim();
console.timeEnd('capture');
console.log('Capture length:', b64.length);

const out = path.resolve(__dirname, '..', 'runs', 'verified_interactive.jpg');
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('Wrote verified image to:', out);
