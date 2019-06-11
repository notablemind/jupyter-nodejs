
import zmq from 'zeromq'

const r = zmq.socket('dealer')
const p = zmq.socket('router')

const uri = 'tcp://127.0.0.1:55432'

p.bind('tcp://*:55432', err => {
  console.log('FaILE', err)
  if (err) {
    process.exit()
  }
  r.connect(uri)
  p.on('message', function () {
    console.log([].map.call(arguments, a => a.toString()))
  })
  r.send(['hi', 'ho', 'cherry'])
  setTimeout(() => {
    process.exit()
  }, 200)
  
})

