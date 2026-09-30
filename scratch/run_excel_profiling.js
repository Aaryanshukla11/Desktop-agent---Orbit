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
  console.log('=== STARTING EXCEL SALES DATA TASK RUN & LIVE PROFILING ===');
  
  console.log('Waiting for app bridge to be live...');
  while (true) {
    try {
      const state = await getState();
      if (state && (state.status === 'init' || state.status === 'end' || state.status === 'error')) {
        console.log('App bridge is ONLINE and READY! State:', state.status);
        break;
      }
    } catch (e) {
      // not yet up
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const taskPrompt = 'open EXCEL and dummy 200 Sales data and save it on desktop as sales dummy.xlsx';

  // 1. Clear previous history
  console.log('[Step 1] Clearing previous history...');
  await postIPC('clearHistory', []);
  await new Promise((r) => setTimeout(r, 1000));

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
  let loopsCompleted = 0;

  while (Date.now() - runStart < 300000) { // 5 min max
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const state = await getState();
      const msgs = state.messages || [];

      if (msgs.length > lastMsgCount) {
        for (let i = lastMsgCount; i < msgs.length; i++) {
          const m = msgs[i];
          const type = m.type;
          const status = m.status;
          const pred = m.prediction;
          const action = m.action;
          const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);

          console.log(`\n[+${elapsed}s] [Step #${i}] [Type: ${type}, Status: ${status}]`);
          if (pred) {
            console.log(`  Thought/Prediction: ${pred.replace(/\n+/g, ' ').slice(0, 180)}`);
          }
          if (action) {
            console.log(`  Action: ${JSON.stringify(action)}`);
          }
        }
        lastMsgCount = msgs.length;
        loopsCompleted++;
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
}

main().catch(console.error);
