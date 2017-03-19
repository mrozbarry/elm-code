const path = require("path")
const temp = require("temp")
const rimraf = require("rimraf")
const Promise = require("promise")
const spawn = require("cross-spawn")
const elm = require("node-elm-compiler")
const firebase = require("../../config/initializers/firebase.js")
const Queue = require("firebase-queue")

const queueRef = firebase.database().ref("compile-queue")

const bucket = firebase.storage()

const options = {
  numWorkers: process.env.NUMBER_OF_ELM_WORKERS || 1
}


// A task should look like this:
// {
//   "tasks": {
//     "-Djsfgon3oi4n": {
//       "snippetId": "-Djsfgon3oi4n",
//       "packageId": "-SDJGbwrhtnrs",
//       "userId": "github:f34rniburti"
//     }
//   }
// }

const queue = new Queue(queueRef, options, function (data, progress, taskSuccess, taskFail) {
  // Methods

  var validateUser = function () {
    return new Promise(function (resolve, reject) {
      firebase
        .database()
        .ref("users")
        .child(data.userId)
        .once("value", function (snapshot) {
          const user = snapshot.val()
          if (user && !user.isBanned) {
            resolve()
          } else {
            console.error("User either doesn't exist or is banned from compiling code.")
            reject()
          }
        })
    })
  }

  var tempContainer = function () {
    return new Promise(function (resolve, reject) {
      temp.mkdir(data.snippetId, function (err, fullPath) {
        if (err) {
          reject("Unable to create temporary root:", err)
        } else {
          resolve({ fullPath: fullPath })
        }
      })
    })
  }

  var setProgress = function (amount, context) {
    return new Promise(function (resolve, reject) {
      progress(amount)
        .then(function () {
          resolve(context)
        })
        .catch(function (e) {
          console.error("Unable to set task progress", data)
          reject(e)
        })
    })
  }

  var downloadPackageJson = function (context) {
    return new Promise(function (resolve, reject) {
      bucket
        .file("packages/" + data.packageId + "/elm-package.json")
        .download({
          destination: path.resolve(context.fullPath, "elm-package.json")
        }).then(function () {
          resolve(context)
        }).catch(function (e) {
          console.error("Unable to download package json")
          reject(e)
        })
    })
  }

  var downloadMain = function (context) {
    return new Promise(function (resolve, reject) {
      bucket
        .file("snippets/" + data.snippetId + "/Main.elm")
        .download({
          destination: path.resolve(context.fullPath, "Main.elm")
        }).then(function () {
          resolve(context)
        }).catch(function (e) {
          console.error("Unable to download main elm")
          reject(e)
        })
    })
  }

  var elmGithubInstall = function (context) {
    return new Promise(function (resolve, reject) {
      spawn(
        path.resolve(__dirname, "..", "..", "node_modules", ".bin", "elm-github-install"),
        [],
        {
          cwd: context.fullPath
        }
      ).on("close", function (code) {
        if (code != 0) {
          console.error("Runtime error with elm-github-install:", { errorCode: code })
          reject()
        } else {
          resolve(context)
        }
      }).on("error", function (e) {
        console.error("Unable to run elm-github-install:", e)
        reject(e)
      })
    })
  }

  var compile = function (context) {
    return new Promise(function (resolve, reject) {
      elm.compile(["./Main.elm"], {
        cwd: context.fullPath,
        yes: true,
        output: "main.js"
      }).on("close", function (code) {
        if (code != 0) {
          console.error("Runtime error with elm-make:", { errorCode: code })
          reject()
        } else {
          resolve(context)
        }
      }).on("error", function (e) {
        console.error("Unable to run elm-make:", e)
        reject(e)
      })
    })
  }

  var uploadResult = function (context) {
    return new Promise(function (resolve, reject) {
      bucket.upload(path.resolve(context.fullPath, "main.js"), {
        destination: "snippets/" + data.snippetId + "/main.js"
      }).then(function () {
        resolve(context)
      }).catch(function (err) {
        console.error("Unable to upload result:", err)
        reject(err)
      })
    })
  }

  var updateSnippet = function (context) {
    return new Promise(function (resolve, reject) {
      firebase
        .database()
        .ref("snippets")
        .child(data.snippetId)
        .update({ compiledAt: Date.now(), updatedAt: Date.now() })
        .then(function () {
          resolve(context)
        })
        .catch(function (e) {
          console.error("Couldn't update snippet:", e)
          reject(e)
        })
    })
  }

  // Perform task

  console.log("lib/worker - new task", data)

  validateUser()
    .then(tempContainer)
    .then(setProgress.bind(this, 5))
    .then(downloadPackageJson)
    .then(setProgress.bind(this, 10))
    .then(downloadMain)
    .then(setProgress.bind(this, 15))
    .then(elmGithubInstall)
    .then(setProgress.bind(this, 20))
    .then(compile)
    .then(setProgress.bind(this, 90))
    .then(uploadResult)
    .then(setProgress.bind(this, 95))
    .then(updateSnippet)
    .then(function (context) {
      rimraf(context.fullPath, function (err) {
        if (err) {
          console.log("Unable to delete temp directory, maybe this is an error?", err)
        }
        // Give the worker a chance to rest
        setTimeout(taskSuccess, 500)
      })
    })
    .catch(function (e) {
      rimraf(context.fullPath, function (err) {
        // Log e?
        taskFail()
      })
    })

})

module.exports = queue
