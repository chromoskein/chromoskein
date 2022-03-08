import { mergeWithRules } from 'webpack-merge';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import ReactRefreshTypeScript from 'react-refresh-typescript';
import { config } from './webpack.common.mjs';

export default mergeWithRules({
    module: {
        rules: {
            test: "match",
            use: {
                loader: "match",
                options: "replace",
            },
        },

    }
})(config, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        static: './dist',
        open: {
            target: './',
            app: {
                name: 'chrome' //opens in newest version instead of default
            }
        },
        hot: true,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    getCustomTransformers: () => {
                        return {
                            before: [ReactRefreshTypeScript()],
                        }
                    },
                    transpileOnly: true // checks replaced with ForkTsCheckerWebpackPlugin
                }
            },
        ]
    },
    plugins: [
        new ReactRefreshWebpackPlugin(),

    ]
});