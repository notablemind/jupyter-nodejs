
import {EventEmitter} from 'events'
import crypto from 'crypto'

function fixUnicode(val) {
  return val.replace('\ufdd0', '\\ufdd0')
}

const DELIM = '<IDS|MSG>'

function json(data) {
  return fixUnicode(JSON.stringify(data) || '{}')
}

function get_uuid() {
  return Math.random().toString(0x0f).slice(10, 100)
}

const knownSigs = {
  'hmac-sha256': 'sha256'
}

export default class Server extends EventEmitter {
  constructor(connection, config, sockets) {
    super()
    this.sockets = sockets
    this.key = connection.key
    this.sig = knownSigs[connection.signature_scheme]
    if (!this.sig) {
      throw new Error(`Using a signatute scheme I don't know about: ${connection.signature_scheme}`)
    }
    for (let name in sockets) {
      if (name === 'heartbeat') continue
      sockets[name].on('message', this.recv.bind(this, name))
    }
  }

  ping(config, done) {
    const key = config.sock + ':' + config.expect
    let tout = setTimeout(() => {
      console.log('TIMEOUT waiting for', config.expect)
      tout = null
      done(new Error('Timeout'))
    }, config.timeout || 1000)

    const header = this.send(config.sock, '', config.send, config.content, {}, {})

    const events = []
    config.ios && config.ios.forEach(ev => this.on('iopub:' + ev, event))
    function event(payload) {
      if (payload.parent_header.msg_id !== header.msg_id) {
        return // not answering me
      }
      events.push(payload)
    }

    this.on(key, got)
    function got(payload) {
      if (!tout) return console.log('Received after timeout', config.expect)
      // console.log(payload, header)
      if (payload.parent_header.msg_id !== header.msg_id) {
        return // not answering me
      }
      clearTimeout(tout)
      this.off(key, got)
      setTimeout(() => {
        config.ios && config.ios.forEach(ev => this.off('iopub:' + ev, event))
        done(null, payload, events)
      }, 100)
    }

  }

  off(evt, hl) {
    return this.removeListener(evt, hl)
  }

  // sock, delim, hmac, header, parent_header, metadata, content
  recv(sock) {
    const args = [].map.call(arguments, m => m.toString()).slice(1)
    if (sock === 'iopub') {
      args.shift()
    }
    const [delim, hmac, header, parent_header, metadata, content] = args
    const toHash = [header, parent_header, metadata, content].join('')
    const payload = {header, parent_header, metadata, content}
    for (let name in payload) {
      const val = payload[name]
      let parsed
      try {
        parsed = JSON.parse(val)
      } catch (err) {
        this.emit('error', {
          type: 'format',
          message: `${name} is supposed to be JSON, but was ${val}`,
        })
        continue
      }
      payload[name] = parsed
      if (!parsed || 'object' !== typeof parsed || Array.isArray(parsed)) {
        this.emit('error', {
          type: 'format',
          message: `${name} is supposed to be a JSON serialized dictionary, but was ${val}`
        })
      }
    }
    payload.delim = delim
    payload.hmac = hmac
    const hash = this.hash(toHash)
    if (hash !== hmac.toString()) {
      this.emit('error', {
        type: 'security',
        message: "Hashes didn't match",
        data: [hash, hmac.toString()],
      })
    }
    // console.log(sock, header, payload.header.msg_type)
    this.emit(sock, payload)
    this.emit(sock + ':' + payload.header.msg_type, payload)
  }

  send(sock, id, msg_type, content, parent, metadata) {
    const repid = get_uuid()
    const header =  {
      msg_id: repid,
      username: parent.username,
      msg_type: msg_type,
      session: parent.session,
      version: '5.0',
    }
    this._send(sock, id, header, parent, metadata, content)
    return header
  }

  hash(string) {
    const hmac = crypto.createHmac(this.sig, this.key)
    hmac.update(string)
    return hmac.digest('hex')
  }

  _send(sock, id, header, parent, metadata, content) {
    const toHash = [
      json(header),
      json(parent),
      json(metadata || {}),
      json(content)]
    const hmac = this.hash(toHash.join(''))
    const data = [DELIM, hmac].concat(toHash)
    this.sockets[sock].send(data)
  }
}

