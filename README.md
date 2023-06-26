# ghost-vsc

Manually downgraded css-loader@5.2.7 for webpack. See https://github.com/microsoft/monaco-editor/issues/2930
Manually downgraded monaco-editor@0.38.0 due to bug. See https://github.com/microsoft/monaco-editor/issues/4017

# Commands

Only build renderer code and execute:

```
node ./node_modules/webpack/bin/webpack.js --progress; node ./node_modules/electron/cli.js .
```