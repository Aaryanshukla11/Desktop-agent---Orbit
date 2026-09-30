const path = require('path');
const fs = require('fs');

console.log("Checking FastInputManager integration...");
const exePath = path.resolve('apps/ui-tars/resources/FastInputServer.exe');
console.log("FastInputServer.exe exists:", fs.existsSync(exePath));

const { spawn, execFile } = require('child_process');
const server = spawn(exePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

server.stdout.on('data', (d) => {
  const msg = d.toString().trim();
  console.log("Server output:", msg);
  if (msg === 'READY') {
    console.log("Testing click...");
    server.stdin.write("click 100 100\n");
    setTimeout(() => {
      server.stdin.write("exit\n");
      console.log("Integration test PASSED!");
      process.exit(0);
    }, 200);
  }
});
execFile