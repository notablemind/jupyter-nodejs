
export default function getKernelInfo(server, next) {
  server.ping({
    sock: 'shell',
    send: 'kernel_info_request',
    expect: 'kernel_info_reply',
  }, (err, payload) => {
    next(null, {
      type: 'kernel_info_request',
      passed: !err && payload.content && payload.content.language,
      info: !err && payload.content,
      time: Date.now()
    })
  })
}

