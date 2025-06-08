import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

import { typescriptPaths } from 'rollup-plugin-typescript-paths';

export default {
  input: 'src/index.ts',
  output: { file: 'dist/bundle.js', format: 'cjs' },
  plugins: [
    commonjs(),
    json(),
    resolve({
      preferBuiltins: true,
    }),
    typescript(),
    typescriptPaths(),
  ],
};
