const express = require("express")
const path = require("path")

const worker = require("./lib/workers/worker.js")

const port = process.env.PORT || 8000

const app = express()

app.get("/", function (req, res) {
  res.sendFile(path.resolve(__dirname, "app/views/index.html"))
})

app.listen(port, function () {
  console.log("Listening on port %d", port)
})

process.on('SIGINT', function () {
  worker.shutdown().then(function () {
    process.exit(0)
  }).catch(function (e) {
    process.exit(1)
  })
})

