const { keyboard, Key } = require('@computer-use/nut-js');

async function testWinR() {
  console.log('Testing Win+R with NutJS...');
  // NutJS pressKey
  await keyboard.pressKey(Key.LeftSuper);
  await keyboard.pressKey(Key.R);
  await new Promise(r => setTimeout(r, 100));
  await keyboard.releaseKey(Key.R);
  await keyboard.releaseKey(Key.LeftSuper);
  console.log('Pressed LeftSuper + R');
}

testWinR().catch(console.error);
