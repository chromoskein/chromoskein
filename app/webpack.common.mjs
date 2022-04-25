import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
    experiments: {
        // asset: true,
        // outputModule: true
    },
    entry: {
        main: {
            import: './src/index.tsx',
        },
    },
    output: {
        // filename: '[name].js',
        path: resolve(__dirname, './dist'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    transpileOnly: true // checks replaced with ForkTsCheckerWebpackPlugin
                }
            },
            {
                test: [/\.chromoskein/, /\.XYZ/, /\.wgsl/],
                type: 'asset/source',
            },
            // {
            //     test: /\.wgsl/,
            //     type: 'asset/source'
            // },
            // {
            //     test: /\.XYZ/,
            //     type: 'asset/source'
            // },
            {
                test: /\.png/,
                type: 'asset/resource'
            },
            {
                test: [/\.css$/, /\.scss$/],
                use: ["style-loader", "css-loader", "sass-loader"]
            },
            {
                test: /\.svg$/,
                use: [
                    {
                        loader: "svg-inline-loader",
                        options: {
                            removeSVGTagAttrs: false,
                        },
                    },
                ],
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            inject: false,
            template: resolve(__dirname, "public", "index.html"),
            favicon: resolve(__dirname, "public", "favicon.ico"),
        }),
        new ForkTsCheckerWebpackPlugin()
    ],
    resolve: {
        symlinks: false,
        extensions: ['.tsx', '.ts', '.js', '.svg'],
    },
    stats: {
        errorDetails: true
    }
}