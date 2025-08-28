import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import { dts } from 'rollup-plugin-dts';

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [
      commonjs(),
      json(),
      resolve({ preferBuiltins: true }),
      typescript({
        outDir: 'dist',
        declaration: false, // Let dts plugin handle declarations
      }),
      typescriptPaths(),
    ],
    external: [
      // Mark all dependencies as external for Node.js
      '@noble/hashes',
      '@taquito/rpc',
      '@taquito/signer',
      '@taquito/taquito',
      'async-mutex',
      'bignumber.js',
      'lru-cache',
      'qs',
      // Node.js built-ins
      'crypto',
      'fs',
      'path',
      'process',
      'url',
      'util',
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts(), typescript(), typescriptPaths()],
  },
];
