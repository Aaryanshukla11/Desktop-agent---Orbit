const { GUIAgent } = require('../packages/ui-tars/sdk/dist/GUIAgent.js');
const { StatusEnum } = require('../packages/ui-tars/sdk/dist/core.js');

console.log('====================================================');
console.log('   ORBIT BETA: END-TO-END AGENT TASK EXECUTION TEST ');
console.log('====================================================\n');

// 1. Define a Mock VLM Model that simulates 4 steps of a complex task
const mockSteps = [
  {
    thought: 'The user wants to write notes. I will navigate directly to notepad.',
    action: "hotkey(key='win')"
  },
  {
    thought: 'Now I will type notepad to launch it.',
    action: "type(content='notepad\\n')"
  },
  {
    thought: 'Wait for Notepad to finish launching and settle.',
    action: "wait()"
  },
  {
    thought: 'The task is successfully completed.',
    action: "finished()"
  }
];

let currentStep = 0;

const mockModel = {
  factors: [1000, 1000],
  invoke: async (params) => {
    console.log(`\n[MockModel Turn ${currentStep + 1}]:`);
    console.log(`  - Received conversations: ${params.conversations.length}`);
    console.log(`  - Received images: ${params.images ? params.images.length : 0}`);
    
    if (currentStep < mockSteps.length) {
      const step = mockSteps[currentStep++];
      const prediction = `Thought: ${step.thought}\nAction: ${step.action}`;
      return {
        prediction,
        parsedPredictions: [
          {
            thought: step.thought,
            reflection: null,
            action_type: step.action.split('(')[0],
            action_inputs: step.action.includes("key=") ? { key: step.action.match(/key='([^']+)'/)[1] } :
                           step.action.includes("content=") ? { content: step.action.match(/content='([^']+)'/)[1] } : {}
          }
        ],
        costTime: 120,
        costTokens: 150
      };
    }

    return {
      prediction: 'Thought: Done\nAction: finished()',
      parsedPredictions: [{ thought: 'Done', reflection: null, action_type: 'finished', action_inputs: {} }]
    };
  },
  reset: () => {}
};

// 2. Define a Mock Operator for head-less testing
const mockOperator = {
  screenshot: async () => ({
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    scaleFactor: 2
  }),
  execute: async (params) => {
    console.log(`  [Operator Execute] Action: ${params.parsedPrediction.action_type}`, params.parsedPrediction.action_inputs);
    return { status: StatusEnum.RUNNING };
  }
};

async function runTest() {
  const agent = new GUIAgent({
    model: mockModel,
    operator: mockOperator,
    systemPrompt: 'You are Orbit Beta GUI Agent.',
    userInstruction: 'Open Notepad, wait for it, and complete the task.',
    maxLoop: 10,
    onData: async ({ data }) => {
      lastData = data;
      console.log(`  [Agent State Update] Status: ${data.status}`);
    }
  });

  let lastData = null;
  agent.model = mockModel;

  console.log('Starting Orbit Beta GUIAgent.run()...\n');
  await agent.run();
  console.log('\n====================================================');
  console.log('  Agent Run Completed!');
  console.log(`  Final Status: ${lastData?.status}`);
  console.log('====================================================\n');

  if (lastData?.status === StatusEnum.END) {
    console.log('>>> [SUCCESS] Full Agent Task Cycle Executed Perfectly to StatusEnum.END! <<<');
    process.exit(0);
  } else {
    console.error(`>>> [FAIL] Unexpected status: ${lastData?.status} <<<`);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test threw error:', err);
  process.exit(1);
});
