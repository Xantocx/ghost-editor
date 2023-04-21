const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebPackPlugin = require('html-webpack-plugin');
const HtmlWebpackTagsPlugin = require('html-webpack-tags-plugin');

const preloadConfig = {
	name: 'preload',
	mode: 'development',
    target: 'electron-preload',
	entry: {
		preload: './src/app/preload.ts',
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	output: {
		globalObject: 'self',
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist/electron/src/app'),
	},
	module: {
		rules: [
			{
				test: /\.ts?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
}

const rendererConfig = {
	name: 'renderer',
	mode: 'development',
    target: 'electron-renderer',
	entry: {
		app: './src/editor/editor.ts',
		'editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
		'json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
		'css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
		'html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
		'ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker'
	},
	resolve: {
		extensions: ['.ts', '.js']
	},
	output: {
		globalObject: 'self',
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist/renderer'),
	},
	module: {
		rules: [
			{
				test: /\.ts?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				use: ['file-loader']
			}
		]
	},
	plugins: [
        // https://webpack.js.org/plugins/copy-webpack-plugin/
        new CopyPlugin({
            patterns: [
              { from: "src/style/index.css", to: "style" },
              { from: "src/editor/style/editor.css", to: "style" },
            ],
          }),
		new HtmlWebPackPlugin({
			title: 'Ghost Editor',
            template: 'src/index.html'
		}),
        // https://github.com/jharris4/html-webpack-tags-plugin
        new HtmlWebpackTagsPlugin({ 
			tags: ["style/index.css", "style/editor.css"], 
			append: true 
		})
	]
}

module.exports = [preloadConfig, rendererConfig]