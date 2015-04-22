
import http from 'http'
import superagent from 'superagent'

function get(url, done) {
  let failed = false
  http.get(url, res => {
    let data = ''
    res.on('data', chunk => data += chunk.toString())
    res.on('end', () => {
      if (failed) return
      done(null, data)
    })
  }).on('error', err => {
    failed = true
    console.log('err!', err)
    done(err)
  })
}

function post(url, data, done) {
  superagent.post(url)
    .send(data)
    .set('content-type', 'application/clojure')
    .buffer()
    .end((err, res) => {
      done(err, eval(res.text.slice('{:js '.length, -1)))
    })
}

function setupGlobal(url, ctx, done) {
  if (!url) return done(new Error(
    'Clojurescript magic requires a hosted compiler'))
  get(url + '/js/repl.js', (err, data) => {
    if (err) return done(err)

    let g = ctx.getGlobal()
    g.document = {
      createElement: function () {
        return {
          firstChild: {
            nodeType: 3
          },
          getElementsByTagName: function () {
            return []
          },
        }
      }
    }

    try {
      ctx.rawRun(data)
    } catch (e) {
      console.log('Clojurescript init fail!')
      console.log(e.message)
      console.log(e.stack)
      return done(e)
    }

    g.goog.require('cljs.core');
    g.goog.provide('cljs.user');
    g.cljs.core.set_print_fn_BANG_(
      val => g.display(val, 'stdout'))

    done()
  })
}

function translateCode(host, code, done) {
  post(host + '/compile', '{:expr ' + code + '}',
        (err, data) => {
    return done(null, data)
  })
}

export default function extension(ctx, args, done) {
  let host = args && args[0]
  setupGlobal(host, ctx, () => {
    done(null, {block: {clojurescript: {
      transform(ctx, args, code, out, done) {
        translateCode(host, code, done)
      },
      rawOutput(ctx, args, value, out, done) {
        ctx.ctx.display(ctx.ctx.cljs.core.pr_str(value), 'text/plain')
        done()
      },
    }}})
  })
}

