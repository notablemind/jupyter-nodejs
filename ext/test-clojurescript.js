
import {translateCode} from './clojurescript'

translateCode('http://localhost:4432', '(+ 2 3)', (err, code) => {
  console.log(err, code)
})

