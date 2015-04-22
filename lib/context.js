
import Contextify from 'contextify'

import config from '../config'
import getCompletions from './complete'
import loadExt from './load-ext'
import async from 'async'

export default class Context {
  constructor(wired) {
    this.wired = wired
    this.ctx = {
      require,
      itreed: this,
      process,
    }
    Contextify(this.ctx)
    this.magics = {
      block: {},
      line: {
        load_ext: loadExt,
        die: function () {
          fail
        }
      },
    }
    this.dead = false
  }

  shutdown() {
    this.ctx.dispose()
    this.dead = true
  }

  lineMagic(line, out, done) {
    const parts = line.trim().split(/\s+/g)
    if (!this.magics.line[parts[0]]) {
      return done(new Error(`Unknown magic: ${parts[0]}`))
    }
    this.magics.line[parts[0]](this, out, parts.slice(1), done)
  }

  blockMagic(line, block, out, done) {
    const parts = line.trim().split(/\s+/g)
    if (!this.magics.block[parts[0]]) {
      return done(new Error(`Unknown magic: ${parts[0]}`))
    }
    const magic = this.magics.block[parts[0]]
    const args = parts.slice(1)
    if ('function' === typeof magic) {
      return magic(this, args, block, out, done)
    } else if (magic.transform) {
      return magic.transform(this, args, block, out, (err, code) => {
        if (err) return done(err)
        if (magic.rawOutput) {
          let result
          try {
            result = this.rawRun(code)
          } catch (e) {
            return done(e)
          }
          return magic.rawOutput(this, args, result, out, done)
        }
        return this.rawEvaluate(code, out, done)
      })
    }

    done(new Error(`Unknown magic format for ${parts[0]}`))
  }

  rawRun(code) {
    return this.ctx.run(code)
  }

  getGlobal() {
    return this.ctx.getGlobal()
  }

  rawEvaluate(code, out, done) {
    let result
    try {
      result = this.rawRun(code)
    } catch (error) {
      return done(error)
    }
    // TODO allow custom formatters
    return done(null, result !== undefined ? format(result) : null)
  }

  complete(code, pos, done) {
    // TODO allow extension to the completion logic? e.g. for clojurescript
    try {
      return getCompletions(this.magics, this.ctx.getGlobal(), code, pos, done)
    } catch (error) {
      done(error)
    }
  }

  outToContext(out) {
    this.ctx.console = {
      log(...vals) {
        out.stream('stdout', toLogString(vals))
      },
      error(...vals) {
        out.stream('stderr', toLogString(vals))
      },
      warn(...vals) {
        out.stream('stderr', toLogString(vals))
      },
    }

    this.ctx.display = function (val, mime, meta) {
      if (mime === 'stdout' || mime === 'stderr') {
        return out.stream(mime, val)
      }
      if (mime) return out.output({[mime]: val}, meta)
      out.output(format(val))
    }
  }

  execute(code, out, done) {
    if (this.dead) throw new Error('Kernel has been shutdown. Cannot execute')
    this.outToContext(out)

    if (code.match(/^%%/)) {
      const lines = code.split('\n')
      const first = lines.shift()
      try {
        return this.blockMagic(first.slice(2), lines.join('\n'), out, done)
      } catch (error) {
        return done(error)
      }
    }

    const lineMagics = []
    code = code.replace(/^%[^\n]+/m, res => {
      console.log('>', res)
      lineMagics.push(res)
      return ''
    })

    if (!lineMagics.length) {
      return this.rawEvaluate(code, out, done)
    }

    const lineTasks = lineMagics.map(line => next =>
      this.lineMagic(line.slice(1), out, next))

    console.log('series', lineTasks.length)
    async.series(lineTasks, err => {
      if (err) return done(err)
      console.log('done', err)
      return this.rawEvaluate(code, out, done)
    })
  }
}

function toLogString(vals) {
  return vals.map(val => {
    if ('string' === typeof val) return val
    return toSafeString(val)
  }).join(' ') + '\n'
}

function toSafeString(val) {
  let pre = ''
  if ('object' === typeof val && val && val.constructor && val.constructor.name !== 'Object') {
    pre = '[' + val.constructor.name + '] '
  }
  if ('function' === typeof val) {
    return val + ''
  }
  try {
    return pre + JSON.stringify(val)
  } catch (e) {}
  try {
    return pre + '' + val
  } catch (e) {}
  return pre + '[value cannot be rendered]'
}

function format(val) {
  return {
    'text/plain': toSafeString(val)
  }
}

