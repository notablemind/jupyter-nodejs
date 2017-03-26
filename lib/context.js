
// import Contextify from 'contextify'

import config from '../config'
import getCompletions from './complete'
import loadExt from './load-ext'
import async from 'async'
import {spawn} from 'child_process'
import fs from 'fs'
import path from 'path'
import vm from 'vm'

export default class Context {
  constructor(wired) {
    this.wired = wired
    this.ctx = {
      require(name) {
        const full = path.resolve(path.join('node_modules', name))
        if (fs.existsSync(full)) {
          return require(full)
        }

        const start = name.substring(0, 2)

        if (start === './' || start === '..') {
          name = path.resolve(name)
        }

        return require(name)
      },
      itreed: this,
      setTimeout,
      setInterval,
      process,
      Buffer,
      String,
      Number,
    }
    vm.createContext(this.ctx)
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
    delete this.ctx
    // this.ctx.dispose()
    this.dead = true
  }

  lineMagic(line, out, done) {
    const parts = line.trim().split(/\s+/g)
    if (!this.magics.line[parts[0]]) {
      return done(new Error(`Unknown line magic: ${parts[0]}`))
    }
    this.magics.line[parts[0]](this, out, parts.slice(1), done)
  }

  magicComplete(line, code, pos, done) {
    const parts = line.trim().split(/\s+/g)
    if (!this.magics.block[parts[0]]) {
      return false
    }
    const magic = this.magics.block[parts[0]]
    const args = parts.slice(1)
    if (!magic.complete) return false
    var d = require('domain').create()
    d.on('error', err => {
      console.log('async error', err)
      console.log('async error', err.stack)
      done(err)
    })
    d.run(() => {
      magic.complete(this, code, pos, done)
    })
    return true
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
    } else if (magic.execute) {
      return magic.execute(this, args, block, out, done)
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
    return vm.runInContext(code, this.ctx)
  }

  getGlobal() {
    return this.ctx
  }

  rawEvaluate(code, out, done) {
    let result
    var d = require('domain').create()
    d.on('error', err => {
      console.log('async error', err)
      out.error('Async Error', err.message, err.stack)
    })
    d.run(() => {
      try {
        result = this.rawRun(code)
      } catch (error) {
        return done(error)
      }
      // TODO allow custom formatters
      return done(null, result !== undefined ? format(result) : null)
    })
  }

  complete(code, pos, variant, done) {
    let off = 0
    if (code.match(/^%%/)) {
      const lines = code.split('\n')
      const first = lines.shift()
      variant = first.slice(2)
      code = lines.join('\n')
      off = first.length + 1
    }
    if (variant) {
      if (this.magicComplete(variant, code, pos - off, (err, res) => {
        if (res) {
          res.cursor_start += off
          res.cursor_end += off
        }
        done(err, res)
      })) {
        return
      }
    }
    // TODO allow extension to the completion logic? e.g. for clojurescript
    try {
      return getCompletions(this.magics, this.getGlobal(), code, pos, done)
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

  shell(code, out, done) {
    const proc = spawn('sh', ['-x', '-c', code])
    proc.stdout.on('data', data => out.stream('stdout', data.toString()))
    proc.stderr.on('data', data => out.stream('stderr', data.toString()))
    proc.on('close', code => {
      done(code !== 0 ? new Error(`Exit code: ${code}`) : null)
    })
  }

  cd(code, out, done) {
    code = code.replace(/~/g, process.env.HOME)
    try {
      process.chdir(code)
    } catch (e) {
      return done(new Error(`No such dir: ${code}`))
    }
    out.stream('stdout', 'cd to ' + code)
    done()
  }

  checkSpecial(code, out, done) {
    if (code.match(/^%%/)) {
      code = code.split('\n').slice(1).join('\n')
    }

    code = code.trim()

    if (code.match(/!cd /)) { // !cd really should be cd so we persist the changes
      code = code.slice(1)
    }

    if (code[0] === '!' && code.indexOf('\n') === -1) {
      this.shell(code.slice(1), out, done)
      return true
    }

    if (code.indexOf('cd ') === 0 && code.indexOf('\n') === -1) {
      this.cd(code.slice('cd '.length), out, done)
      return true
    }
  }

  execute(code, out, done) {
    if (this.dead) throw new Error('Kernel has been shutdown. Cannot execute')
    this.outToContext(out)

    if (this.checkSpecial(code, out, done)) return

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
