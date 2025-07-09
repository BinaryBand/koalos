import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import { dts } from 'rollup-plugin-dts';

export default [
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.js', format: 'cjs' },
    plugins: [
      commonjs(),
      json(),
      nodeResolve({ preferBuiltins: true }),
      terser({ format: { comments: false } }),
      typescript(),
      typescriptPaths(),
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts(), typescript(), typescriptPaths()],
  },
];
