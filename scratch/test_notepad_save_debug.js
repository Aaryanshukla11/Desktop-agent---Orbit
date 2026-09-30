const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const fastInputExe = path.resolve('apps/ui-tars/resources/FastInputServer.exe');
const targetReportPath = 'C:\\Users\\Aaryan shukla\\OneDrive\\Desktop\\weather_report.md';

async function run() {
  console.log('Testing Notepad save interaction step-by-step...');
  try { execSync('taskkill /f /im notepad.exe', { stdio: 'ignore' }); } catch(e){}

  const server = spawn(fastInputExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let waiter = null;
  server.stdout.on('data', (d) => {
    if (waiter) { const w = waiter; waiter = null; w(d.toString().trim()); }
  });
  const send = (cmd) => new Promise(r => { waiter = r; server.stdin.write(cmd.trim() + '\n'); });
  await new Promise(r => setTimeout(r, 500));

  // 1. Launch notepad
  console.log('Launching notepad...');
  execSync('cmd.exe /c start notepad.exe');
  await new Promise(r => setTimeout(r, 2000));

  // Focus
  await send('click 600 400');
  await new Promise(r => setTimeout(r, 300));

  // 2. Type text
  console.log('Typing text...');
  await send('type # Weather Report\\n| City | Temp |\\n| Delhi | 31C |\\n');
  await new Promise(r => setTimeout(r, 500));

  // 3. Save dialog
  console.log('Triggering Ctrl+S...');
  await send('hotkey ctrl s');
  await new Promise(r => setTimeout(r, 1500));

  // 4. Type path in save dialog
  console.log('Typing path...');
  await send(`type ${targetReportPath}\\n`);
  await new Promise(r => setTimeout(r, 1500));

  // Check if file exists
  console.log('Checking file existence immediately after enter:');
  console.log('Exists:', fs.existsSync(targetReportPath));

  // If not, try Alt+S or Enter again
  if (!fs.existsSync(targetReportPath)) {
    console.log('Trying Enter again...');
    await send('hotkey enter');
    await new Promise(r => setTimeout(r, 1500));
    console.log('Exists after 2nd enter:', fs.existsSync(targetReportPath));
  }

  server.kill();
}
run();
