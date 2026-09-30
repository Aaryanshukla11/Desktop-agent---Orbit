const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const exePath = path.resolve('apps/ui-tars/resources/FastInputServer.exe');

async function run() {
  console.log('=== TESTING EXCEL WORKFLOW DIRECTLY VIA FASTINPUTSERVER ===');
  
  // Close any existing excel
  try {
    execSync('taskkill /f /im excel.exe', { stdio: 'ignore' });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1000));

  // Spawn FastInputServer
  const server = spawn(exePath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  
  let waiter = null;
  server.stdout.on('data', (d) => {
    const text = d.toString().trim();
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(text);
    }
  });

  const send = (cmd) => new Promise((resolve) => {
    waiter = resolve;
    server.stdin.write(cmd.trim() + '\n');
  });

  // Wait for READY
  await new Promise(r => setTimeout(r, 500));

  // 1. Open Excel directly
  console.log('[1] Launching Excel via start excel...');
  try {
    execSync('cmd.exe /c start excel', { stdio: 'ignore' });
  } catch (e) {
    console.error('Launch failed:', e);
  }

  console.log('Waiting 3.5s for Excel to initialize...');
  await new Promise(r => setTimeout(r, 3500));

  // 2. Select A1
  console.log('[2] Selecting cell A1 with Ctrl+Home...');
  await send('hotkey ctrl home');
  await new Promise(r => setTimeout(r, 400));

  // 3. Type headers: ID, Product, Sales
  console.log('[3] Typing headers: ID\\tProduct\\tSales\\n...');
  await send('type ID\\tProduct\\tSales\\n');
  await new Promise(r => setTimeout(r, 600));

  // 4. Type the formula in cell A2
  console.log('[4] Entering formula in cell A2...');
  const formula = '=HSTACK(SEQUENCE(200), "Product " & SEQUENCE(200), RANDARRAY(200, 1, 100, 999, TRUE))\\n';
  await send('type ' + formula);
  await new Promise(r => setTimeout(r, 1000));

  // 5. Screenshot to verify sheet
  const ssPath = path.resolve('scratch/excel_populated_test.jpg');
  console.log('[5] Taking verification screenshot to', ssPath);
  await send(`screenshot ${ssPath}`);
  await new Promise(r => setTimeout(r, 500));

  if (fs.existsSync(ssPath)) {
    const stat = fs.statSync(ssPath);
    console.log(`Screenshot captured! Size: ${stat.size} bytes`);
  } else {
    console.log('Screenshot NOT found!');
  }

  // 6. Test F12 save
  console.log('[6] Pressing F12 for Save As dialog...');
  await send('hotkey f12');
  await new Promise(r => setTimeout(r, 1800));

  const desktopFile = path.join(process.env.USERPROFILE || 'C:\\Users\\Aaryan shukla', 'Desktop', 'sales dummy.xlsx');
  console.log('[7] Typing filename and saving to:', desktopFile);
  
  // Delete if already exists
  if (fs.existsSync(desktopFile)) {
    try { fs.unlinkSync(desktopFile); } catch (e) {}
  }

  await send(`type ${desktopFile}\\n`);
  await new Promise(r => setTimeout(r, 2500));

  if (fs.existsSync(desktopFile)) {
    const fstat = fs.statSync(desktopFile);
    console.log(`SUCCESS! File saved to desktop! Size: ${fstat.size} bytes`);
  } else {
    console.log('File not detected immediately at full path, trying standard filename...');
  }

  server.stdin.write('exit\n');
  console.log('Test completed.');
}

run().catch(console.error);
