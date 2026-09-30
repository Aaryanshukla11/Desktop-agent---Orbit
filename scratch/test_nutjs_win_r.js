const { keyboard, Key } = require('@computer-use/nut-js');

async function main() {
  console.log('Testing Win+R: pressing LeftSuper and R...');
  await keyboard.pressKey(Key.LeftSuper, Key.R);
  await new Promise(r => setTimeout(r, 100));
  await keyboard.releaseKey(Key.LeftSuper, Key.R);
  console.log('Done!');
}

main().catch(console.error);
