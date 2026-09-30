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
  console.log('=== INITIATING DETERMINISTIC T0 RUN ===');
  const { execSync } = require('child_process');

  // Minimize occlusions so desktop is visible
  try {
    console.log('Minimizing occluding windows...');
    execSync('powershell -ExecutionPolicy Bypass -File "scratch/min_all.ps1"');
  } catch (e) {
    console.log('Minimize error:', e.message);
  }
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Clear history
  console.log('\n[1/3] Clearing history...');
  await postIPC('clearHistory', []);
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Set instructions
  const instruction = "Double click the test_notepad text file icon located at the center of the desktop (around row 4, column 5, start_box='[468, 611, 468, 611]') to open it in Notepad, then verify that ORBIT_T0_SUCCESS_123 is displayed.";
  console.log(`[2/3] Setting instructions: "${instruction}"...`);
  await postIPC('setInstructions', [
    { instructions: instruction },
  ]);
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Trigger runAgent
  console.log('[3/3] Triggering runAgent...');
  postIPC('runAgent', []).catch((e) => console.log('runAgent call completed or error:', e.message));

  // 4. Poll state
  console.log('\n[4/4] Monitoring live execution...');
  let lastMsgCount = 0;
  let startTime = Date.now();

  while (Date.now() - startTime < 180000) { // 3 minute max
    await new Promise((r) => setTimeout(r, 3000));
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
          console.log(`\n--- [Message #${i}] Type: ${type}, Status: ${status} ---`);
          if (pred) {
            console.log('Prediction:', pred.slice(0, 300));
          }
          if (action) {
            console.log('Action:', JSON.stringify(action));
          }
        }
        lastMsgCount = msgs.length;
      }

      console.log(`[Status: ${state.status}, Thinking: ${state.thinking}, Messages: ${msgs.length}]`);

      if (state.status === 'end' || (state.status === 'call_user' && !state.thinking)) {
        console.log(`\nExecution stopped with status: ${state.status}`);
        break;
      }
    } catch (err) {
      console.log('Polling error:', err.message);
    }
  }

  console.log('Finished monitoring. Checking T0 evidence directories...');
}

main().catch(console.error);
