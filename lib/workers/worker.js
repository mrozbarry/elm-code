const elm = require("node-elm-compiler")
const firebase = require("../../config/initializers/firebase.js")
const Queue = require("firebase-queue")
const storage = require("@google-cloud/storage")
const path = require("path")
const temp = require("temp")
const fs = require("fs")
const extractZip = require("extract-zip")
const rimraf = require("rimraf")

const queueRef = firebase.database().ref("compile-queue")

const options = {
  numWorkers: 1,
  sanitize: false
}

const projectId = "elm-code"

const bucket = storage({
  projectId: projectId,
  keyFilename: path.resolve(__dirname, "../../config/serviceAccount.json")
}).bucket(projectId + ".appspot.com")

const queue = new Queue(queueRef, options, function (data, progress, resolve, reject) {
  progress(0)

  temp.mkdir(data._id, function (err, fullPath) {
    if (err) {
      return reject("Unable to create temporary root")
    }

    // Clean up this task's local files
    const cleanup = function (done) {
      rimraf(fullPath, done)
    }

    firebase
      .database()
      .ref("entries")
      .child(data.entryId)
      .once("value", function (snapshot) {
        const entry = snapshot.val()
        progress(1)

        const templateZip = path.resolve(fullPath, "template.zip")

        bucket.file("templates/" + entry.template).download({
          destination: templateZip
        }).then(function () {
          progress(20)

          extractZip(templateZip, { dir: fullPath }, function (err) {
            if (err) {
              return cleanup(function () {
                reject("Unable to extract zip", templateZip)
              })
            }
            progress(40)

            const entryFile = path.resolve(fullPath, "Main.elm")

            bucket.file("entries/" + data.entryId + "/Main.elm").download({
              destination: entryFile
            }).then(function () {
              progress(60)

              try {
                elm.compile(["./Main.elm"], {
                  cwd: fullPath,
                  yes: true,
                  output: data.entryId + ".html"
                }).on("close", function (exitCode) {
                  progress(80)
                  if (exitCode != 0) {
                    return reject("elm-make: Error " + exitCode)
                  } else {
                    bucket.upload(path.resolve(fullPath, data.entryId + ".html"), {
                      destination: "entries/" + data.entryId + "/result.html"
                    }, function (err) {
                      if (err) {
                        reject("Unable to upload result")
                      } else {
                        progress(99).then(resolve)
                      }
                    })
                  }
                }).on("error", function () {
                  reject("Compile error")
                })
              } catch (e) {
                reject("Compile error:" + e.toString())
              }

            }).catch(function (err) {
              cleanup(function () { reject("Unable to download entry files") })
            })

          })
        }).catch(function (err) {
          cleanup(function () {
            reject("Couldn't find the file")
          })
        })

      })



  })
})

process.on('SIGINT', function () {
  queue.shutdown().then(function () {
    process.exit(0)
  })
})
