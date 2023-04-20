# ghost-vsc

Manually downgraded css-loader for webpack. See https://github.com/microsoft/monaco-editor/issues/2930

# Commands

Only build renderer code and execute:

```
node ./node_modules/webpack/bin/webpack.js --progress; node ./node_modules/electron/cli.js .
```