'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var json = require('@rollup/plugin-json');
var terser = require('@rollup/plugin-terser');
var commonjs = require('@rollup/plugin-commonjs');
var pluginNodeResolve = require('@rollup/plugin-node-resolve');
var typescript = require('@rollup/plugin-typescript');
var rollupPluginTypescriptPaths = require('rollup-plugin-typescript-paths');
var rollupPluginDts = require('rollup-plugin-dts');

var rollup_config = [
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.js', format: 'cjs' },
    plugins: [
      commonjs(),
      json(),
      pluginNodeResolve.nodeResolve({ preferBuiltins: true }),
      terser({ format: { comments: false } }),
      typescript(),
      rollupPluginTypescriptPaths.typescriptPaths(),
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [rollupPluginDts.dts(), typescript(), rollupPluginTypescriptPaths.typescriptPaths()],
  },
];

exports.default = rollup_config;
