require('esbuild').build({
    entryPoints: ['src/index.tsx'],
    outfile: 'dist/out.js',
    bundle: true,
    loader: {
      '.wgsl': 'text',
      '.png': 'file',
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