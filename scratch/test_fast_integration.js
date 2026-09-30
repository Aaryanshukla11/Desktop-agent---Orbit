const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function test() {
  console.log("=== VERIFYING FASTINPUTSERVER ENHANCEMENTS ===");
  const exe = path.resolve('apps/ui-tars/resources/FastInputServer.exe');
  const p = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

  let waiter = null;
  p.stdout.on('data', d => {
    const lines = d.toString().split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      console.log("<- Server:", line);
      if (line === 'READY' || line.startsWith('OK') || line.startsWith('ERR')) {
        if (waiter) {
          const w = waiter;
          waiter = null;
          w(line);
        }
      }
    }
  });

  const send = (cmd) => new Promise(resolve => {
    waiter = resolve;
    console.log("-> Sending:", cmd);
    p.stdin.write(cmd + '\n');
  });

  // 1. Wait ready
  await new Promise(r => setTimeout(r, 300));

  // 2. Test Screenshot with spaces in path
  const testCapPath = path.resolve('scratch/test space screenshot.jpg');
  if (fs.existsSync(testCapPath)) fs.unlinkSync(testCapPath);
  const capRes = await send(`screenshot ${testCapPath}`);
  console.log("Screenshot result:", capRes, "File exists:", fs.existsSync(testCapPath));
  if (fs.existsSync(testCapPath)) {
    console.log("File size:", fs.statSync(testCapPath).size, "bytes");
  }

  // 3. Test click at physical coordinates
  const clickRes = await send('click 500 500');
  console.log("Click result:", clickRes);

  // 4. Test hotkey win
  const winRes = await send('hotkey win');
  console.log("Hotkey win result:", winRes);

  p.stdin.write('exit\n');
  console.log("=== INTEGRATION TEST COMPLETE ===");
}

test().catch(console.error);
