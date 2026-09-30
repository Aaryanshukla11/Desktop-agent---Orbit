const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

function checkBridge() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:5174/api/state', (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function restart() {
  console.log("=== RESTARTING UI-TARS ELECTRON WITH NEW OPTIMIZED BUILD ===");

  // 1. Kill old electron processes
  try {
    execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
  } catch (e) {}
  try {
    execSync('taskkill /F /IM FastInputServer.exe', { stdio: 'ignore' });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1000));

  // 2. Launch electron with new build
  const electronExe = path.resolve('node_modules/electron/dist/electron.exe');
  const appDir = path.resolve('apps/ui-tars');

  console.log("Launching:", electronExe, "in", appDir);
  const child = spawn(electronExe, ['.'], {
    cwd: appDir,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  console.log("Waiting for app bridge to be live on port 5174...");
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 1000));
    const ok = await checkBridge();
    if (ok) {
      console.log("SUCCESS: UI-TARS app is UP and bridge is LIVE!");
      return;
    }
    attempts++;
  }
  console.log("Timed out waiting for bridge.");
}

restart().catch(console.error);
