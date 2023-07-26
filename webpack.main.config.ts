import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';

// eslint-disable-next-line import/default
import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';

export const mainConfig: Configuration = {
    /**
     * This is the main entry point for your application, it's the first file
     * that runs in the main process.
     */
    entry: './src/index.ts',
    // Put your normal webpack config below here
    module: {
        rules,
    },
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                // Copy over prisma scheme and engine to account for the incompatibility of electron forge and prisma's generated client.
                { from: './.env', to: './' },
                { from: './node_modules/.prisma/client/schema.prisma', to: './schema.prisma' },
                { from: './node_modules/.prisma/client/*.node', to: ({ absoluteFilename }) => `./${path.basename(absoluteFilename!)}` },
            ],
        }),
    ]
};
