
import async from 'async'
import zmq from 'zmq'

export default function setupSockets(config, done) {
  const sockets = {
    control: {
      port: config.control_port,
      type: 'dealer',
    },
    shell: {
      port: config.shell_port,
      type: 'dealer',
    },
    stdin: {
      port: config.stdin_port,
      type: 'dealer',
    },
    iopub: {
      port: config.iopub_port,
      type: 'sub',
    },
    heartbeat: {
      port: config.hb_port,
      type: 'req',
    }
  }
  const tasks = {}
  for (let name in sockets) {
    tasks[name] = setupSocket.bind(null, sockets[name], config)
  }
  async.parallel(tasks, done)
}

function setupSocket(config, general, done) {
  const sock = zmq.socket(config.type);
  const addr = general.transport + '://' + general.ip + ':' + config.port
  sock.connect(addr)
  if (config.type === 'sub') {
    sock.subscribe('')
  }
  done(null, sock)
}

