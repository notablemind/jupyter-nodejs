
import setupSockets from './sockets'
import info from './info'
import crypto from 'crypto'
import Context from './context'

function get_uuid() {
  return Math.random().toString(0x0f).slice(10, 100)
}

const DELIM = '<IDS|MSG>'

const knownSigs = {
  'hmac-sha256': 'sha256'
}


export default class Kernel {
  constructor(config) {
    this.config = config
    this.ctx = new Context()
    this.count = 0
    this.key = config.key
    this.sig = knownSigs[config.signature_scheme]
    if (!this.sig) {
      throw new Error(`Using a signatute scheme I don't know about: ${connection.signature_scheme}`)
    }
  }

  init(done) {
    setupSockets(this.config, (err, sockets) => {
      if (err) return done(err)
      this.sockets = sockets
      this.bindSockets()
      done()
    })
  }

  bindSockets() {
    const hb = this.sockets.heartbeat
    hb.on('message', data => hb.send(data))
    this.sockets.shell.on('message', this.onShell.bind(this))
    this.sockets.control.on('message', this.onControl.bind(this))
  }

  onControl() {
    console.log('CONTROL')
    for(let i in arguments){
        console.log("["+i+"]: "+arguments[i].toString())
    }
  }

  // uuid, delim, hmac, header, parent_header, metadata, content
  onShell() {
    const strs = [].map.call(arguments, a => a.toString())
    let i
    for (i=0; i<strs.length; i++) {
      if (strs[i] === DELIM) {
        break
      }
    }
    const idents = [].slice.call(arguments, 0, i)
    const args = strs.slice(i + 2)
    const uuid = idents[idents.length - 1]
    let [header, parent_header, metadata, content] = args

    header = JSON.parse(header)
    if (header.msg_type === 'kernel_info_request') {
      this.send('shell', uuid, 'kernel_info_reply', info, header)
      return
    }
    if (header.msg_type === 'history_request') {
      this.send('shell', uuid, 'history_reply', {history: []}, header)
      return
    }

    metadata = JSON.parse(metadata)
    content = JSON.parse(content)
    if (header.msg_type === 'execute_request') {
      this.executeRequest(uuid, header, metadata, content)
      return
    }
    if (header.msg_type === 'complete_request') {
      this.completeRequest(uuid, header, metadata, content)
      return
    }
    if (header.msg_type === 'shutdown_request') {
      this.ctx.shutdown()
      this.send('shell', uuid, 'shutdown_response', content, header)
      return
    }
    console.log('Unknown message type: ', header.msg_type)
    for(let i in arguments){
        console.log("["+i+"]: "+arguments[i].toString())
    }
  }

  ioPub(msg_type, content, parent) {
    this.send('iopub', get_uuid(), msg_type, content, parent)
  }

  completeRequest(uuid, header, metadata, content) {
    this.ctx.complete(content.code, content.cursor_pos, metadata.variant, (error, completions) => {
      if (error) {
        console.log(error)
        return this.send('shell', uuid, 'complete_reply', {
          status: 'err'
        }, header)
      }
      this.send('shell', uuid, 'complete_reply', completions, header)
    })
  }

  sendStream(header, stream, text) {
    this.ioPub('stream', {
      name: stream,
      text: text,
    }, header)
  }

  sendOutput(header, data, metadata) {
    this.ioPub('display_data', {
      source: 'nodejs',
      data: data,
      metadata: metadata || {}
    }, header)
  }

  sendError(header, name, message, stack) {
    this.ioPub('error', {
      ename: name,
      evalue: message,
      trackeback: [stack],
    }, header)
  }

  executeRequest(uuid, header, metadata, content) {
    this.ioPub('status', {execution_state: 'busy'}, header)
    this.count += 1
    this.ioPub('execute_input', {
      code: content.code,
      execution_count: this.count,
    }, header)
    this.ctx.execute(content.code, {
      stream: this.sendStream.bind(this, header),
      output: this.sendOutput.bind(this, header),
      error: this.sendError.bind(this, header),
    }, (error, result) => {
      if (error) {
        this.ioPub('error', {
          ename: 'Javascript Error',
          evalue: error.message,
          traceback: [error.stack],
        }, header)
        this.send('shell', uuid, 'execute_reply', {
          status: 'error',
          ename: 'Runtime error',
          evalue: error.message,
          traceback: [error.stack],
          execution_count: this.count,
          user_expressions: {},
          payload: []
        }, header, {
          status: 'error',
        })
      } else {
        if (result) {
          this.ioPub('execute_result', {
            execution_count: this.count,
            data: result,
          }, header)
        }
        this.send('shell', uuid, 'execute_reply', {
          status: 'ok',
          execution_count: this.count,
          user_expressions: {},
          payload: []
        }, header, {
          status: 'ok',
        })
      }
      this.ioPub('status', {execution_state: 'idle'}, header)
    })
  }

  send(sock, id, msg_type, content, parent, metadata) {
    const repid = get_uuid()
    this._send(sock, id, {
      msg_id: repid,
      username: parent.username,
      msg_type: msg_type,
      session: parent.session,
      version: '5.0',
    }, parent, metadata, content)
  }

  hash(string) {
    const hmac = crypto.createHmac(this.sig, this.key)
    hmac.update(string)
    const res = hmac.digest('hex')
    return res
  }

  _send(sock, id, header, parent, metadata, content) {
    const toHash = [
      json(header),
      json(parent),
      json(metadata || {}),
      json(content)]
    const hmac = this.hash(toHash.join(''))
    const data = [id, DELIM, hmac].concat(toHash)
    this.sockets[sock].send(data)
  }
}

function fixUnicode(val) {
  return val.replace('\ufdd0', '\\ufdd0')
}

function json(data) {
  return fixUnicode(JSON.stringify(data))
}

