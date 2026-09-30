const { keyboard, Key } = require('@computer-use/nut-js');

async function testHotkeys(...keys) {
  for (const k of keys) {
    await keyboard.pressKey(k);
    await new Promise(r => setTimeout(r, 20));
  }
  await new Promise(r => setTimeout(r, 100));
  for (const k of [...keys].reverse()) {
    await keyboard.releaseKey(k);
    await new Promise(r => setTimeout(r, 20));
  }
  console.log('Success sending hotkeys:', keys);
}

async function main() {
  await testHotkeys(Key.LeftControl, Key.Escape);
}

main().catch(console.error);
