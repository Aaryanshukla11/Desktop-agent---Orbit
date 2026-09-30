const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const exePath = path.resolve('apps/ui-tars/resources/FastInputServer.exe');
if (!fs.existsSync(exePath)) {
  console.error("FastInputServer.exe not found at:", exePath);
  process.exit(1);
}

console.log("Starting Humanized Mouse Glide & Action Demo...");
const server = spawn(exePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

server.stdout.on('data', async (d) => {
  const msg = d.toString().trim();
  if (msg === 'READY') {
    console.log("Server READY! Demonstrating smooth Bézier glide across screen...");

    // Smooth Glide from current to (700, 400)
    await humanGlide(server, 200, 200, 800, 500, 140);
    await sleep(50);

    // Smooth Glide to another point (400, 700)
    await humanGlide(server, 800, 500, 400, 700, 140);
    await sleep(50);

    // Natural click
    server.stdin.write("click 400 700\n");
    await sleep(200);

    console.log("Demo finished successfully! Exiting.");
    server.stdin.write("exit\n");
    process.exit(0);
  }
});

async function humanGlide(server, startX, startY, targetX, targetY, duration = 120) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.hypot(dx, dy);
  const steps = 16;
  const stepInterval = Math.round(duration / steps);

  const perpX = -dy / distance;
  const perpY = dx / distance;
  const curveAmp = 18;

  const p1X = startX + dx * 0.33 + perpX * curveAmp;
  const p1Y = startY + dy * 0.33 + perpY * curveAmp;
  const p2X = startX + dx * 0.66 + perpX * (curveAmp * 0.5);
  const p2Y = startY + dy * 0.66 + perpY * (curveAmp * 0.5);

  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const t = 1 - Math.pow(1 - progress, 2.5); // Ease-Out
    const u = 1 - t;

    const curX = Math.round(u * u * u * startX + 3 * u * u * t * p1X + 3 * u * t * t * p2X + t * t * t * targetX);
    const curY = Math.round(u * u * u * startY + 3 * u * u * t * p1Y + 3 * u * t * t * p2Y + t * t * t * targetY);

    server.stdin.write(`move ${curX} ${curY}\n`);
    await sleep(stepInterval);
  }
}
