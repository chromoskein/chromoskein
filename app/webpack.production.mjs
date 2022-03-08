import { merge } from 'webpack-merge';
import { config } from './webpack.common.mjs';

export default merge(config, {
    mode: 'production'
});