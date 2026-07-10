/**
 
 */
import { bingSearch } from './bing-search';
import { browserSearch } from './browser-search';
import { tavilySearch } from './tavily-search';

async function main() {
  console.log('Running isomorphic search examples...');

  await Promise.all([bingSearch(), browserSearch(), tavilySearch()]);
}

if (require.main === module) {
  main().catch(console.error);
}
