const { keyboard, Key } = require('@computer-use/nut-js');

async function test(winKey, name) {
  console.log(`Testing with ${name} (${winKey})...`);
  await keyboard.pressKey(winKey, Key.R);
  await new Promise(r => setTimeout(r, 100));
  await keyboard.releaseKey(Key.R, winKey);
  console.log('Released.');
}

async function main() {
  await test(Key.LeftWin, 'Key.LeftWin');
  await new Promise(r => setTimeout(r, 2000));
  await test(Key.LeftSuper, 'Key.LeftSuper');
}

main().catch(console.error);
