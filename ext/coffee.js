
export default function (ctx, args, done) {
  let coffee = require('coffee-script')
  done(null, {
    block: {
      coffee: {
        transform(ctx, args, code, out, done) {
          const opts = { }
          try {
            code = coffee.compile(code, opts)
          } catch (err) {
            return done(err)
          }
          console.log('coffee->\n', code)
          done(null, code)
        }
      },
    },
  })
}
