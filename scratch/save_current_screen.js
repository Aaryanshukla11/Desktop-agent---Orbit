const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const ps1 = 'C:\\Users\\Aaryan shukla\\.gemini\\antigravity-ide\\brain\\0e3ea434-2b5c-4667-9e76-48bc877c6067\\scratch\\screenshot.ps1';
const b64 = execSync(`powershell -ExecutionPolicy Bypass -File "${ps1}"`, {
  maxBuffer: 50 * 1024 * 1024,
}).toString().trim();

const target = path.join(__dirname, '..', 'runs', 'current_desktop.jpg');
fs.writeFileSync(target, Buffer.from(b64, 'base64'));
console.log('Saved to:', target, 'Size:', fs.statSync(target).size);
