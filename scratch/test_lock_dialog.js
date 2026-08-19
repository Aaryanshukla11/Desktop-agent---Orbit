 const { spawn, execSync } = require('child_process');
const path = require('path');

const fastInputExe = path.resolve('apps/ui-tars/resources/FastInputServer.exe');

async function testDialogLock() {
  console.log('Testing lock_dialog command directly...');
  const server = spawn(fastInputExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let waiter = null;
  server.stdout.on('data', (d) => {
    if (waiter) { const w = waiter; waiter = null; w(d.toString().trim()); }
  });
  const send = (cmd) => new Promise(r => { waiter = r; server.stdin.write(cmd.trim() + '\n'); });
  await new Promise(r => setTimeout(r, 500));

  console.log('Launching notepad...');
  execSync('cmd.exe /c start notepad.exe');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Sending type text...');
  const typeB64 = (str) => send(`type_b64 ${Buffer.from(str, 'utf8').toString('base64')}`);
  await typeB64('hello world\n');
  await new Promise(r => setTimeout(r, 500));

  console.log('Sending Ctrl+S...');
  await send('hotkey ctrl s');
  await new Promise(r => setTimeout(r, 1200));

  console.log('Calling lock_dialog...');
  const res = await send('lock_dialog');
  console.log('Result of lock_dialog:', res);

  server.kill();
}
testDialogLock();
