import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/auto-bbq.ts', 'src/cli/cli.ts'],
  format: ['esm'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: true,
  splitting: false
});
