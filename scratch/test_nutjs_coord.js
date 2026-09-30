const { mouse, Point } = require('@computer-use/nut-js');

async function test() {
  const pos = await mouse.getPosition();
  console.log('Current mouse position:', pos);
  await mouse.setPosition(new Point(100, 100));
  const newPos = await mouse.getPosition();
  console.log('New mouse position after setting (100, 100):', newPos);
}

test().catch(console.error);
