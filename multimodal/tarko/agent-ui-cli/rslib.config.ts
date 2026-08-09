/*
 
 */

import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      bundle: false,
      dts: true,
      format: 'esm',
    },
    {
      bundle: false,
      dts: false,
      format: 'cjs',
    },
  ],
  output: {
    target: 'node',
  },
});
