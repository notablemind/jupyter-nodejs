
const net = require('net')
const fs = require('fs')
const path = require('path')
const bencode = require('bencode')
const {EventEmitter} = require('events')

function bocket(sock) {
  const em = new EventEmitter()
  let buffer = new Buffer('')
  sock.on('connect', () => em.emit('connect'))
  sock.on('data', data => {
    buffer = Buffer.concat([buffer, data])
    while (buffer.length) {
      let res
      try {
        res = bencode.decode(buffer, 'utf8')
      } catch (err) {
        return
      }
      let used = bencode.encode(res, 'utf8').length
      buffer = buffer.slice(used)
      em.emit('data', res)
    }
  })
  sock.on('error', err => em.emit('error', err))
  return {
    on(val, fn) {
      return em.on(val, fn)
    },
    off(val, fn) {
      return em.removeListener(val, fn)
    },
    close() {
      sock.close()
    },
    send(val) {
      return sock.write(bencode.encode(val))
    },
    _sock: sock
  }
}

class Session extends EventEmitter {
  constructor(port, session) {
    super()
    this.bock = bocket(net.connect({port}))
    this.waiting = []
    this.queue = []
    this.session = session || null
    this.bock.on('data', this.onData.bind(this))
    this.bock.on('connect', () => {
      if (!this.session) {
        this.send({op: 'clone'}, data => {
          this.session = data[0]['new-session']
          console.log(data)
          this.emit('connect')
        })
      } else {
        this.emit('connect')
      }
    })
  }

  send(data, done) {
    if (this.session) {
      data.session = this.session
    }
    this.waiting.push(done)
    this.bock.send(data)
  }

  eval(val, done) {
    this.send({op: 'eval', code: val}, done)
  }

  op(name, args, done) {
    if (arguments.length === 2) {
      done = args
      args = {}
    }
    args = args || {}
    args.op = name
    this.send(args, done)
  }

  onData(data) {
    if (!this.waiting.length) {
      return console.error('Data, came, but no one waited...', data)
    }
    if (this.waiting[0].partial) {
      this.waiting[0].partial(data)
    }
    this.queue.push(data)
    if (data.status && data.status[0] === 'done'){
      if (this.waiting[0].final) {
        this.waiting.shift().final(this.queue)
      } else {
        this.waiting.shift()(this.queue)
      }
      this.queue = []
    }
  }

  e(val) {
    this.eval(val, data => data.map(d => console.log(JSON.stringify(d, null, 2))))
  }
}

export default function extension(ctx, args, done) {
  let port = args && parseInt(args[0])
  if (!port) {
    return done(new Error("Port is required"))
  }
  let s
  try {
    s = new Session(port)
  } catch (e) {
    return done(e)
  }
  s.on('connect', () => {
    s.eval(`(do (use 'clj-info) (use 'clojure.repl) (use 'complete.core))`, data => {
      done(null, {block:{clojure:{
        execute(ctx, args, code, out, done) {
          s.eval(`(do ${code})`, {
            partial: data => {
              if (data.out) {
                out.stream('stdout', data.out)
              } else if (data.value) {
                out.output({'text/plain': data.value})
              } else if (data.err) {
                // out.error('Runtime error', 'err', data.err)
              }
            },
            final: data => {
              if (data[0].status && data[0].status[0] === 'eval-error') {
                return done(new Error("Eval failed: " + data[1].err))
              }
              done(null)
            }
          })
        },
        complete(ctx, code, pos, done) {
          const line = code.slice(0, pos).split('\n').pop()
          const chunks = line.split(/[\s()\[{}\]]/g)
          const last = chunks[chunks.length - 1]
          // console.log('Completing:', JSON.stringify([code, pos], null, 2), last, last.length)
          s.eval(`(map symbol (completions "${last}"))`, data => {
            if (data[0].value) {
              const res = {
                matches: data[0].value.slice(1, -1).split(' '),
                status: 'ok',
                cursor_start: pos - last.length,
                cursor_end: pos,
              }
              done(null, res)
            } else {
              console.log('Matches failed!')
              data.forEach(d => console.log(JSON.stringify(d, null, 2)))
              done(null, {
                status: 'err'
              })
            }
          })
        }
      }}})
    })
  })
}


