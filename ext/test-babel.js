
import ModuleFormatter from './babel-module-loader'
import * as babel from 'babel'

const opts = {
  modules: ModuleFormatter
}


let code = babel.transform('import fs from "fs"', opts)
console.log(code.code)

