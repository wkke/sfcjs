const { bundle } = require('../../bundler');
const path = require('path');
const fs = require('fs');

const code = bundle(path.resolve(__dirname, './index.htm'), {
  outputDir: __dirname,
  ignores: [
    path.resolve(__dirname, './index.htm'),
  ],
  macro: true,
});

fs.writeFileSync(path.resolve(__dirname, 'bundle.js'), code);
