
module.exports = {
  extensions: {
    // clojurescript: require('./ext/clojurescript'),
    clojurescript: require('./build/ext/clojurescript'),
    coffee: require('./build/ext/coffee'),
    babel: require('./build/ext/babel')
  }
}
