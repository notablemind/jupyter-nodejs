
import testKernel from './kernel'
import path from 'path'

const connection = require(path.resolve(process.argv[2]))
const config = require(path.resolve(process.argv[3]))

testKernel(connection, config)

