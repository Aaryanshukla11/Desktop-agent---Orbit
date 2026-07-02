/**
 
 */
export default {
  '*': ['secretlint'],
  '**/*.{ts,tsx}': ['prettier --write'],
  'src/{main,preload}/**/*.{ts,tsx}': [() => 'npm run typecheck:node'],
  'src/renderer/**/*.{ts,tsx}': [() => 'npm run typecheck:web'],
};
