import http from 'http';

function callIpc(channel, args = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ channel, args });
    const req = http.request(
      'http://localhost:5174/api/ipc',
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
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const settings = await callIpc('setting:get');
  console.log('Current Settings:', JSON.stringify(settings, null, 2));
}

main().catch(console.error);
