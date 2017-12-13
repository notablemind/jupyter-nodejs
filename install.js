
var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')

var installPath;
if (process.platform == 'win32') // NB: this is true for both 32- and 64-bit Windows
    installPath = path.join(process.env.APPDATA, 'jupyter/kernels/nodejs')
else
    installPath = path.join(process.env.HOME, '.ipython/kernels/nodejs')

if (process.argv.length >= 3) {
  installPath = process.argv[2]
}

console.log('install', installPath)
var fullPath = path.resolve(installPath)

mkdirp(fullPath, function() {
  fs.writeFileSync(path.join(fullPath, 'kernel.json'), JSON.stringify({
    argv: ['node', path.join(path.resolve(__dirname), 'build', 'run.js'), '{connection_file}'],
    display_name: 'NodeJS',
    language: 'javascript',
  }, null, 2))
});
