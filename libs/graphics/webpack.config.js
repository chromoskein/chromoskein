const path = require('path');

module.exports = {
  entry: './src/index.ts',

  // experiments: {
  //   outputModule: true
  // },

  module: {
    rules: [
      {
        test: /\.wgsl/,
        type: 'asset/source'
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    symlinks: false
  },

  devtool: 'source-map',

  output: {
    filename: 'chromatin_3d_viewport.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'chromatin_3d_viewport',
      type: 'var'
    },
  },
};