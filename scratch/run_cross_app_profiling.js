const http = require('http');
const fs = require('fs');
const path = require('path');

function postIPC(channel, args = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ channel, args });
    const req = http.request(
      'http://127.0.0.1:5174/api/ipc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body || '{}'));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getState() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:5174/api/state', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (e) {
          resolve({});
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== STARTING BENCHMARK 2: CROSS-APPLICATION (NOTEPAD + CALCULATOR) ===');

  console.log('Waiting for app bridge to be live...');
  while (true) {
    try {
      const state = await getState();
      if (state && (state.status === 'init' || state.status === 'end' || state.status === 'error')) {
        console.log('App bridge is ONLINE and READY! State:', state.status);
        break;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Remove existing report if present
  const reportPath = 'C:\\Users\\Aaryan shukla\\Desktop\\Q3_Report.md';
  if (fs.existsSync(reportPath)) {
    try {
      fs.unlinkSync(reportPath);
      console.log('Cleaned up existing Q3_Report.md');
    } catch (e) {}
  }
  try {
    const { execSync } = require('child_process');
    execSync('taskkill /f /t /im notepad.exe /im CalculatorApp.exe /im calc.exe', { stdio: 'ignore' });
  } catch (e) {}

  const taskPrompt = 'open Notepad, write a markdown report with title "# Q3 Performance Report" and a 3-column table (Metric | Target | Actual), then open Calculator, calculate 18500 * 4 + 7200, copy the result from Calculator, paste it into the Notepad report as "Total Revenue: [result]", and save the file on Desktop as Q3_Report.md';

  // 1. Clear previous history & minimize desktop clutter
  console.log('[Step 1] Clearing previous history and preparing clean desktop...');
  try {
    const fastInputPath = path.join(__dirname, '../apps/ui-tars/resources/FastInputServer.exe');
    if (fs.existsSync(fastInputPath)) {
      const { spawn } = require('child_process');
      const p = spawn(fastInputPath);
      p.stdin.write('hotkey esc\nminimize_all\nexit\n');
    }
  } catch (e) {}
  await postIPC('clearHistory', []);
  await new Promise((r) => setTimeout(r, 1200));

  // 2. Set new instruction
  console.log(`[Step 2] Setting instruction: "${taskPrompt}"...`);
  await postIPC('setInstructions', [{ instructions: taskPrompt }]);
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Trigger runAgent
  console.log('[Step 3] Triggering runAgent execution...');
  const runStart = Date.now();
  postIPC('runAgent', []).catch((e) => console.log('runAgent call info:', e.message));

  // 4. Poll and monitor execution in real time
  console.log('[Step 4] Monitoring live execution and metrics...');
  let lastMsgCount = 0;

  while (Date.now() - runStart < 300000) { // 5 min max
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const state = await getState();
      const msgs = state.messages || [];

      if (msgs.length > lastMsgCount) {
        for (let i = lastMsgCount; i < msgs.length; i++) {
          const m = msgs[i];
          const from = m.from;
          const val = m.value || '';
          const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);

          if (from === 'gpt') {
            console.log(`\n[+${elapsed}s] [Step #${i}] [GPT Prediction]:`);
            console.log(`  ${val.replace(/\r?\n/g, '\n  ').slice(0, 300)}`);
          } else if (from === 'human' && val !== '<image>') {
            console.log(`\n[+${elapsed}s] [Step #${i}] [Human]: ${val.slice(0, 100)}`);
          }
        }
        lastMsgCount = msgs.length;
      }

      process.stdout.write(`\rElapsed: ${((Date.now() - runStart) / 1000).toFixed(0)}s | Status: ${state.status} | Thinking: ${state.thinking} | Steps: ${msgs.length}`);

      if (state.status === 'end' || state.status === 'call_user' || state.status === 'error') {
        const totalDuration = ((Date.now() - runStart) / 1000).toFixed(1);
        console.log(`\n\n=== RUN COMPLETED ===`);
        console.log(`Final Status: ${state.status}`);
        console.log(`Total Elapsed Time: ${totalDuration}s`);
        console.log(`Total Steps Executed: ${msgs.length}`);
        break;
      }
    } catch (err) {
      console.log('Polling err:', err.message);
    }
  }

  // 5. Verification on Disk
  console.log('\n=== DISK VERIFICATION ===');
  if (fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf8');
    console.log(`SUCCESS! ${reportPath} exists on Desktop!`);
    console.log(`File size: ${content.length} bytes`);
    console.log('--- Content Preview ---');
    console.log(content.slice(0, 400));
    console.log('-----------------------');
    const hasMathResult = content.includes('81200') || content.includes('81,200');
    console.log(`Contains accurate Calculator result (81,200): ${hasMathResult}`);
  } else {
    console.log(`FAILED: ${reportPath} does not exist on disk.`);
  }
}

main().catch(console.error);
