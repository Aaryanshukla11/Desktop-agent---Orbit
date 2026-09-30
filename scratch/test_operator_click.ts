import { NutJSOperator } from '../packages/ui-tars/operators/nut-js/src/index';
import { mouse, Point } from '@computer-use/nut-js';

async function testClick() {
  const operator = new NutJSOperator();
  console.log('Testing NutJSOperator.execute click at start_box="[0.1, 0.2, 0.1, 0.2]" (screenWidth=1440, screenHeight=900)...');
  const t0 = Date.now();
  await operator.execute({
    prediction: '',
    parsedPrediction: {
      action_type: 'click',
      action_inputs: {
        start_box: '[0.1, 0.2, 0.1, 0.2]'
      },
      reflection: null,
      thought: 'test'
    },
    screenWidth: 1440,
    screenHeight: 900,
    scaleFactor: 2,
    factors: [1000, 1000]
  });
  console.log(`operator.execute took ${Date.now() - t0}ms`);
}

testClick().catch(console.error);
