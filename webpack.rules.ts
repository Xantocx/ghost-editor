import type { ModuleOptions } from 'webpack';

export const rules: Required<ModuleOptions>['rules'] = [
    // Add support for native node modules
    {
        // We're specifying native_modules in the test because the asset relocator loader generates a
        // "fake" .node file which is really a cjs file.
        test: /native_modules[/\\].+\.node$/,
        use: 'node-loader',
    },
    // This loader currently interfers with the monaco-editor, as it rewrites webpack config code in the workers to use __dirname which is currently unsupported in the renderer.
    // This might be a bug or else, for more info, follow: https://github.com/electron/forge/issues/2931
    /*
    {
        test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
        // This loader currently also interfers with loading the prisma query engine. Even if it is used, we have to manually exclude prisma and manually copy it (see forge.congif.ts).
        // More info, and maybe a future fix: https://github.com/prisma/prisma/issues/12627
        exclude: /\.prisma/,
        parser: { amd: false },
        use: {
            loader: '@vercel/webpack-asset-relocator-loader',
            options: {
                outputAssetBase: 'native_modules',
            },
        },
    },
    */
    {
        test: /\.tsx?$/,
        exclude: /(node_modules|\.webpack)/,
        use: {
            loader: 'ts-loader',
            options: {
                transpileOnly: true,
            },
        },
    },
];
