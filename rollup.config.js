import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';

export default {
  input: 'src/index.ts',
  output: { file: 'dist/tezos-wallet.js', format: 'cjs' },
  plugins: [
    commonjs(),
    json(),
    resolve({ preferBuiltins: true }),
    terser({ format: { comments: false } }),
    typescript(),
    typescriptPaths(),
  ],
};
