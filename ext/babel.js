
export default function (ctx, args, done) {
  let babel
  try {
    babel = require('babel')
  } catch (err) {
    return done(new Error('The package `babel` was not found. Please install'))
  }
  done(null, {
    block: {
      babel: {
        transform(ctx, args, code, out, done) {
          const opts = { }
          if (args && args.indexOf('experimental') !== -1) {
            opts.stage = 0
          }
          try {
            code = babel.transform(code, opts).code
          } catch (err) {
            return done(err)
          }
          // slice off the "use strict"
          code = code.split('\n').slice(1).join('\n')
          console.log('Babel->', code)
          done(null, code)
        }
      },
    },
  })
}

