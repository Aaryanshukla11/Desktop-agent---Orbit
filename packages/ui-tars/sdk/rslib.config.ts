/**
 
 */
import { defineConfig } from '@rslib/core';
import { rslibConfig } from '@common/configs/rslib.config';

export default defineConfig({
  ...rslibConfig,
  output: {
    ...rslibConfig.output,
    target: 'web',
  },
});
