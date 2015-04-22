
import fs from 'fs'
import path from 'path'

export default function complete(magics, glob, code, pos, done) {
  const options = [
    completeFiles,
    completeScope
  ]
  function next() {
    if (!options.length) return done(null, {status: 'err'})
    options.shift()(magics, glob, code, pos, (err, res) => {
      if (err) return done(err)
      if (res === false) return next()
      done(null, res)
    })
  }
  next()
}

function completeScope(magics, glob, code, pos, done) {
  code = code.slice(0, pos)
  const chunks = code.split(/[^\w\.]/)
  const lastChunk = chunks[chunks.length - 1]
  const parts = lastChunk.split('.')
  const last = parts.pop().toLowerCase()
  const val = parts.reduce((obj, attr) => {
    if (!obj) return null
    return obj[attr]
  }, glob)
  if (!val) {
    return {
      matches: [],
      cursor_start: pos,
      cursor_end: pos,
      status: 'ok',
    }
  }
  let names = Object.getOwnPropertyNames(val)
  for (let name in val) {
    if (names.indexOf(name) === -1)
      names.push(name)
  }
  done(null, {
    matches: names.filter(name => name.toLowerCase().indexOf(last) === 0),
    cursor_start: pos - last.length,
    cursor_end: pos,
    status: 'ok',
  })
}

function completeFiles(magics, glob, code, pos, done) {
  const line = code.slice(0, pos).split('\n').slice(-1)[0]
  let lastPart = line.split(' ').slice(-1)[0]
  if (!lastPart.match(/\.?\/[^\s]*$/)) {
    return done(null, false)
  }
  let ix = lastPart.indexOf('./')
  let abs = false
  if (ix === -1) {
    ix = lastPart.indexOf('/')
    abs = true
  }
  lastPart = lastPart.slice(ix)
  const chunks = lastPart.split('/')
  const lastChunk = chunks.pop()
  let basePath = chunks.join('/')
  if (abs && basePath[0] !== '/') {
    basePath = '/' + basePath
  }
  fs.readdir(path.resolve(basePath), (err, files) => {
    done(null, {
      matches: files ? files.filter(name => name.toLowerCase().indexOf(lastChunk) === 0).map(name => path.join(basePath, name)) : [],
      cursor_start: pos - lastPart.length + (abs ? 0 : 2),
      cursor_end: pos,
      status: 'ok'
    })
  })
}

