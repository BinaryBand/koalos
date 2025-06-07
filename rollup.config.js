import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.ts',
  output: { file: 'dist/bundle.js', format: 'esm' },
  plugins: [commonjs(), json(), nodeResolve(), resolve(), typescript()],
};
