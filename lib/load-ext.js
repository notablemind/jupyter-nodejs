
import config from '../config'

export default function loadExt(ctx, out, args, done) {
  const name = args.shift()
  if (!config.extensions) {
    throw new Error(`No extensions configured (trying to load ${name}`)
  }
  if (!name) {
    throw new Error("No extension specified to load")
  }
  if (!config.extensions[name]) {
    throw new Error(`Extension ${name} not available`)
  }
  config.extensions[name](ctx, args, (err, magics) => {
    if (err || !magics) return done(err)
    for (let name in magics.block) {
      ctx.magics.block[name] = magics.block[name]
    }
    for (let name in magics.line) {
      ctx.magics.line[name] = magics.line[name]
    }
    done()
  })
}

