import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { build } from 'esbuild';

build({
  entryPoints: ['src/modules/graphics/bvh/binned_sah_builder.worker.ts'],
  target: 'es2020',
  format: 'esm',
  outfile: 'dist/binned_sah_builder.worker.ts',
  bundle: true,
  preserveSymlinks: true,
  watch: {
    onRebuild(error, result) {
      if (error) console.error('watch 2 build failed:', error)
      else console.log('watch 2 build succeeded:', result)
    },
  },
}).then(result => {
  console.log('watching...')
})

build({
  entryPoints: ['src/index.tsx'],
  target: 'es2020',
  format: 'esm',
  outfile: 'dist/out.js',
  bundle: true,
  loader: {
    '.wgsl': 'text',
    '.png': 'file',
    '.pdb': 'file'
  },
  preserveSymlinks: true,
  watch: {
    onRebuild(error, result) {
      if (error) console.error('watch build failed:', error)
      else console.log('watch build succeeded:', result)
    },
  },
}).then(result => {
  console.log('watching...')
})