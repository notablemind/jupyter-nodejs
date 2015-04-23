
export default function testHeartbeat(sock, errors) {
  let sent = null
  const m = data => {
    data = data.toString()
    if (data !== sent) {
      errors.push({
        type: 'bad heartbeat',
        passed: data === sent,
        sent: sent,
        got: data,
        time: Date.now()
      })
    }
    sent = null
  }
  sock.on('message', m)
  const hb = setInterval(() => {
    if (sent !== null) {
      errors.push({
        type: 'missed heartbeat',
        passed: false,
        sent: sent,
        got: 'no response',
        time: Date.now()
      })
    }
    sock.send(sent = Math.random().toString(0xf).slice(10, 40))
  }, 200)
  return () => {
    sock.removeListener('message', m)
    clearInterval(hb)
  }
}

