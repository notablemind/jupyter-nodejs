
import Kernel from './kernel'

if (process.argv.length != 3) {
  console.log('Need a JSON config object')
  process.exit()
}

const config = require(process.argv[2])

const kernel = new Kernel(config)

kernel.init(err => {
  if (err) {
    console.error("Failed to init")
    process.exit()
  }
})


