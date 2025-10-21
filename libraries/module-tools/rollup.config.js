import pkg from './package.json' with { type: "json" };
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';

export default [
  {
    input: 'src/index.ts',
    plugins: [json(), commonjs(), typescript()],
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
        plugins: [
          replace({
            lodash: 'lodash-es',
          }),
        ],
      },
    ],
  },
];
