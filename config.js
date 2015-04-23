
module.exports = {
  extensions: {
    // clojurescript: require('./ext/clojurescript'),
    clojure: require('./build/ext/clojure'),
    clojurescript: require('./build/ext/clojurescript'),
    coffee: require('./build/ext/coffee'),
    babel: require('./build/ext/babel')
  }
}
