# Jupyter NodeJS
This is a kernel for [Jupyter](http://github.com/ipython/ipython)

Get it while it's hot! or view the [example notebook](http://nbviewer.ipython.org/gist/jaredly/404a36306fdee6a1737a)

## Prereqs
- IPython 3.x
- node

## Installation
Grab the [release package](https://github.com/notablemind/jupyter-nodejs/releases/download/v1.1.0/jupyter-nodejs-1.1.0.tgz)
```bash
tar xf jupyter-nodejs-1.1.0.tgz
cd package
mkdir -p ~/.ipython/kernels/nodejs/
npm install && node install.js
ipython console --kernel nodejs
```

And viola!

![image](https://cloud.githubusercontent.com/assets/112170/7268122/a33b186c-e882-11e4-8463-be00a6c90163.png)


Also, in the iPython notebook:

![image](https://cloud.githubusercontent.com/assets/112170/7268108/70cade4e-e882-11e4-95e7-8a7375b3b888.png)



## Supported features:

- tab-completion (both for variables and **paths**)
- error reporting
- magics! The available extensions can be configured via `package/config.js`

## Installation
`node install.js [install-dir]` will install the `kernel.json` file that ipython looks for. The default is for linux machines, `~/.ipython/kernels/nodejs/`. You will have to specify an install dir for Mac and Windows (see [the docs](https://ipython.org/ipython-doc/dev/development/kernels.html#kernel-specs) for info about what that should be)

## BabelJS Magic for es6+ goodness
`%load_ext babel` and then

```javascript
%%babel
class Awesome {
  constructor() {
    console.log('yeah!')
  }
}
```

**Hovever:** `import ...` syntax *doesn't work* because of [live bindings](https://github.com/ModuleLoader/es6-module-loader/wiki/Circular-References-&-Bindings#es6-circular-references--bindings) foo, so just use `require()` normally and all will be well.

## Clojurescript compilation via a [himera](https://github.com/fogus/himera) server

`%load_ext clojurescript http://himera-emh.herokuapp.com` and then

```clojure
%%clojurescript
(clojurey goodness)
```
