
import async from 'async'
import zmq from 'zmq'

export default function setupSockets(config, done) {
  const sockets = {
    control: {
      port: config.control_port,
      type: 'xrep',
    },
    shell: {
      port: config.shell_port,
      type: 'xrep',
    },
    stdin: {
      port: config.stdin_port,
      type: 'router',
    },
    iopub: {
      port: config.iopub_port,
      type: 'pub',
    },
    heartbeat: {
      port: config.hb_port,
      type: 'rep',
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
  sock.bind(addr, err => {
    // console.log('sock', addr, err)
    done(err, sock)
  })
}

