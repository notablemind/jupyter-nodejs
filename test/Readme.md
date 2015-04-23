
# Testing an IPython Client

connection.json should be the standard ipython kernel connection file format

```
{
  "control_port": 50160,
  "shell_port": 57503,
  "transport": "tcp",
  "signature_scheme": "hmac-sha256",
  "stdin_port": 52597,
  "hb_port": 42540,
  "ip": "127.0.0.1",
  "iopub_port": 40885,
  "key": "a0436f6c-1916-498b-8eb9-e81ab9368e84"
}
```

`config.json` should contain:

```
{
  "execute": {
    "{test name}": {
      "payload": execute_request payload,
      "output": what will be sent to display_data
      OR
      "error": {ename, evalue} expected
    },
  },
  "complete": {
    "{code}": [] // list of completions (order invariant)
  }
}
```

