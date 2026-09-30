const http = require('http');
const fs = require('fs');

http.get('http://127.0.0.1:5174/api/state', (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const s = JSON.parse(body);
    const msgs = s.messages || [];
    console.log('Total messages:', msgs.length);
    let count = 0;
    for (let i = msgs.length - 1; i >= 0 && count < 3; i--) {
      const m = msgs[i];
      if (m.screenshotBase64) {
        fs.writeFileSync(`scratch/debug_last_${count}.jpg`, Buffer.from(m.screenshotBase64, 'base64'));
        console.log(`Saved scratch/debug_last_${count}.jpg from step ${i}`);
        count++;
      }
    }
  });
});
