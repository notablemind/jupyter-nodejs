
export default function (ctx, args, done) {
  let coffee = require('coffee-script')
  done(null, {
    block: {
      coffee: {
        transform(ctx, args, code, out, done) {
          const opts = { bare: args.indexOf('bare') !== -1 }
          try {
            code = coffee.compile(code, opts)
          } catch (err) {
            return done(err)
          }
          if (args.indexOf('no-prompt') === -1) {
            console.log('coffee->\n', code)
          } else {
            console.log(code)
          }
          done(null, code)
        }
      },
    },
  })
}
