/**
 
 */
import { MyMCPAgent, getCommonOptions, run, runOptions } from './shared';

export { runOptions };

export const agent = new MyMCPAgent({
  ...getCommonOptions('review__doubao-1.5-thinking-vision-pro.md'),
  model: {
    provider: 'volcengine',
    apiKey: process.env.ARK_API_KEY,
    id: 'ep-20250510145437-5sxhs', // 'doubao-1.5-thinking-vision-pro',
  },
  toolCallEngine: 'structured_outputs',
  maxTokens: 16384,
});

async function main() {
  await run(agent);
}

if (require.main === module) {
  main();
}
