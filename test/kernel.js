
import setupSockets from './sockets'
import crypto from 'crypto'

import Server from './server'
import getKernelInfo from './get-kernel-info'
import testHeartbeat from './heartbeat'
import async from 'async'

function isSubset(one, larger) {
  if (one === larger) return true
  if (!one || !larger) return false
  if (typeof one !== typeof larger) return false
  if ('object' !== typeof one) return false
  if (one.constructor.name !== larger.constructor.name) return false
  if (Array.isArray(one)) {
    return !one.some(n => !larger.some(l => isSubset(n, l)))
  }
  for (let name in one) {
    if (!isSubset(one[name], larger[name])) return false
  }
  return true
}

export default function (connection, config) {
  let errors = []
  setupSockets(connection, (err, sockets) => {
    console.log('Sockets connected: testing')
    const stopHeartbeat = testHeartbeat(sockets.heartbeat, errors)

    const server = new Server(connection, config, sockets)

    server.on('error', err => errors.push(err))

    let tasks = []

    // setTimeout is so the heartbeats can go
    tasks.push(next => setTimeout(() => getKernelInfo(server, next), 500))
    tasks.push(next => server.ping({
      sock: 'shell',
      send: 'history_request',
      expect: 'history_reply',
    }, (err, payload) => {
      next(null, {
        type: 'history_request',
        passed: !err && payload && payload.content && payload.content.history && Array.isArray(payload.content.history)
      })
    }))

    tasks = tasks.concat(Object.keys(config.execute).map(
      name => next => server.ping({
        sock: 'shell',
        send: 'execute_request',
        ios: ['display_data', 'execute_result', 'execute_input', 'error', 'status'],
        content: config.execute[name].content,
        expect: 'execute_reply',
      }, (err, payload, events) => {
        const execute = config.execute[name]
        let missing = []
        if (!events) missing = execute.events
        else {
          execute.events.forEach(ev => {
            const failed = !events.some(ev2 =>
              ev2.header.msg_type === ev.type &&
              isSubset(ev.content, ev2.content)
            )
            if (failed) missing.push(ev)
          })
        }
        next(null, {
          type: 'execute',
          passed: !missing.length,
          events,
          missing,
        })
      })
    ))

    tasks = tasks.concat(Object.keys(config.complete).map(
      code => next => server.ping({
        sock:'shell',
        send: 'complete_request',
        expect: 'complete_reply',
        content: {code: code, cursor_pos: code.length}
      }, (err, payload) => {
        let missing = config.complete[code].filter(name => payload.content.matches.indexOf(name) === -1)
        next(null, {
          type: 'complete',
          passed: !missing.length,
          matches: payload.content.matches,
          missing,
        })
      })
    ))

    async.series(tasks, (err, tests) => {
      if (err) console.log('Error from async', err)
      stopHeartbeat()
      console.log(JSON.stringify(tests.filter(t => !t.passed), null, 2))
      const failed = tests.filter(t => !t.passed)
      console.log()
      console.log()
      if (!failed.length) {
        console.log(`>>>>>>> ALL ${tests.length} PASSED <<<<<<<<`)
      } else {
        console.log('!!!!!!!!!', failed.length + '/' + tests.length + ' failures !!!!!!!')
      }
      console.log(errors.length, 'errors', errors)
      console.log()
      process.exit()
    })
  })
}

