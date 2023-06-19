const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebPackPlugin = require('html-webpack-plugin');
const HtmlWebpackTagsPlugin = require('html-webpack-tags-plugin');

const mainConfig = {
	name: 'main',
	mode: 'development',
    target: 'electron-main',
	entry: {
		main: './src/main.ts',
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	output: {
		globalObject: 'self',
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist/electron'),
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
	externals: {
		typeorm: "commonjs typeorm",
	}
}

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
		path: path.resolve(__dirname, 'dist/electron'),
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
              	{ from: "src/app/style/index.css", to: "style" },
              	{ from: "src/editor/style/editor.css", to: "style" },
				{ from: "src/libs/p5js/p5.min.js", to: "libs/p5js" },
				{ from: "node_modules/iframe-resizer/js/iframeResizer.contentWindow.min.js", to: "libs/iframe-resizer" },
				{ from: "node_modules/iframe-resizer/js/iframeResizer.contentWindow.map", to: "libs/iframe-resizer" }
            ],
        }),
		new HtmlWebPackPlugin({
			title: 'Ghost Editor',
            template: 'src/app/index.html'
		}),
        // https://github.com/jharris4/html-webpack-tags-plugin
        new HtmlWebpackTagsPlugin({ 
			tags: ["style/index.css", "style/editor.css"], 
			append: true 
		})
	]
}

module.exports = [mainConfig, preloadConfig, rendererConfig]