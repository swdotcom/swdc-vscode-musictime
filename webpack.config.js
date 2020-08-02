//@ts-check

"use strict";

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

/**@type {import('webpack').Configuration}*/
const config = {
	target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	entry: "./src/extension.ts", // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	node: {
		__dirname: false,
		__filename: false,
	},
	devtool: "source-map",
	externals: {
		vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
	},
	resolve: {
		// support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		extensions: [".ts", ".js"],
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "./resources", to: "resources" },
				{ from: "./images", to: "images" },
				{ from: "./README.md", to: "resources" },
				{ from: "./src/extensioninfo.json", to: "resources" },
			],
		}),
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
				options: { allowTsInNodeModules: true }
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				use: ["file-loader"],
			},
		],
	},
};
module.exports = config;
