/*
 
 */

/**
 * A example to use models from "ollama".
 *
 * Note: Ollama does not support hidden reasoning tokens.
 * @see https://github.com/ollama/ollama/issues/8875
 */

import { Agent } from '../../src';

async function main() {
  const agent = new Agent({
    model: {
      provider: 'ollama',
      id: 'deepseek-r1:14b',
    },
  });
  const answer = await agent.run('Hello, what is your name?');
  console.log(answer);
}

main();
