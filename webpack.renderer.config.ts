import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// eslint-disable-next-line import/default
import CopyPlugin from 'copy-webpack-plugin';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

rules.push({
    test: /\.css$/,
    use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

// required by MonacoWebpackPlugin
rules.push({
    test: /\.ttf$/,
	use: ['file-loader']
})

export const rendererConfig: Configuration = {
    module: {
        rules,
    },
    plugins: [
        ...plugins,
        // For plugin details, see: https://webpack.js.org/plugins/copy-webpack-plugin/
        new CopyPlugin({
            patterns: [
                { from: 'src/libs/p5js/p5.min.js', to: 'libs/p5js' },
                { from: 'node_modules/iframe-resizer/js/iframeResizer.contentWindow.min.js', to: 'libs/iframe-resizer' },
                { from: 'node_modules/iframe-resizer/js/iframeResizer.contentWindow.map', to: 'libs/iframe-resizer' }
            ],
        }),
        // This sets up the workers needed for the monaco-editor automatically. Currently, this seems to interfer with the native_modules loader in webpack.rules.ts, so the loader was disabled.
        // For more plugin details, see: https://www.npmjs.com/package/monaco-editor-webpack-plugin
        new MonacoWebpackPlugin(),
    ],
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    }
};
