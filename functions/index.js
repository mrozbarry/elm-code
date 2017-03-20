const path = require("path")
const temp = require("temp")
const Promise = require("promise")
const spawn = require("cross-spawn")
const elm = require("node-elm-compiler")

const functions = require("firebase-functions")
const gcs = require("@google-cloud/storage")()
const admin = require("firebase-admin")

admin.initializeApp(functions.config().firebase)

exports.compileProject = functions.database.ref("/compile-jobs/{snippetId}")
  .onWrite(function (event) {
    // Early exit if the the data isn't new, or there isn't any data
    if (event.data.previous.exists() || !event.data.exists()) {
      return
    }
    // Early exit if there is a data mismatch
    if (event.data.key() != event.params.snippetId) {
      return
    }

    const job = event.data.val()

    const jobRef = admin.database().ref("compile-jobs").child(event.params.snippetId)

    var setState = function (state, percentage, context) {
      return new Promise(function (resolve, reject) {
        jobRef
          .update({
            state: state,
            progress: percentage
          })
          .then(resolve)
          .catch(reject)
      })
    }

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

    var downloadPackageJson = function (context) {
      return new Promise(function (resolve, reject) {
        gcs
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
        gcs
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
        gcs.upload(path.resolve(context.fullPath, "main.js"), {
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

    return setState.bind(this, "begin", 0)
      .then(validateUser)
      .then(setState.bind(this, "sync", 10))
      .then(tempContainer)
      .then(setState.bind(this, "sync", 5))
      .then(downloadPackageJson)
      .then(setState.bind(this, "sync", 10))
      .then(downloadMain)
      .then(setState.bind(this, "sync", 15))
      .then(elmGithubInstall)
      .then(setState.bind(this, "packages", 20))
      .then(compile)
      .then(setState.bind(this, "compile", 90))
      .then(uploadResult)
      .then(setState.bind(this, "end", 95))
      .then(updateSnippet)
      .then(function () {
        return new Promise(function (resolve, reject) {
          jobRef
            .remove()
            .then(resolve)
            .catch(reject)
        })
      })
      .catch(function (e) {
        jobRef
          .update({ state: "error", error: JSON.stringify(e) })
      })
})
