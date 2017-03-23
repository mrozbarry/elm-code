const path = require("path")
const fs = require("fs")
const temp = require("temp")
const Promise = require("promise")
const spawn = require("cross-spawn")
const elm = require("node-elm-compiler")

const functions = require("firebase-functions")
const gcs = require("@google-cloud/storage")()
const admin = require("firebase-admin")

const bucket = gcs.bucket("elm-source.appspot.com")

admin.initializeApp(functions.config().firebase)

exports.compileProject = functions.database.ref("/compile-jobs/{snippetId}")
  .onWrite(function (event) {
    // Early exit if the the data isn't new, or there isn't any data
    if (event.data.previous.exists() || !event.data.exists()) {
      return
    }
    // Early exit if there is a data mismatch
    if (event.data.key != event.params.snippetId) {
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
          .then(function () {
            resolve(context)
          })
          .catch(function () {
            reject("Unable to set state (" + state + ", " + percentage + ")")
          })
      })
    }

    var validateUser = function (context) {
      return new Promise(function (resolve, reject) {
        admin
          .database()
          .ref("users")
          .child(job.userId)
          .once("value", function (snapshot) {
            const user = snapshot.val()
            if (user && !user.isBanned) {
              resolve(context)
            } else {
              console.error("User either doesn't exist or is banned from compiling code.")
              reject("Unable to validate user")
            }
          })
      })
    }

    var tempContainer = function (context) {
      return new Promise(function (resolve, reject) {
        temp.mkdir(job.snippetId, function (err, fullPath) {
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
        bucket
          .file("packages/" + job.packageId + "/elm-package.json")
          .download({
            destination: path.resolve(context.fullPath, "elm-package.json")
          }).then(function () {
            resolve(context)
          }).catch(function (e) {
            console.error("Unable to download package json")
            reject("Unable to get elm-package.json")
          })
      })
    }

    var downloadMain = function (context) {
      return new Promise(function (resolve, reject) {
        bucket
          .file("snippets/" + job.snippetId + "/Main.elm")
          .download({
            destination: path.resolve(context.fullPath, "Main.elm")
          }).then(function () {
            resolve(context)
          }).catch(function (e) {
            console.error("Unable to download main elm")
            reject("Unable to get elm source file")
          })
      })
    }

    var elmPackageInstall = function (context) {
      const elmPackageInstallBin = path.resolve(__dirname, "node_modules", ".bin", "elm-proper-install")
      console.log("elmPackageInstall", elmPackageInstallBin)
      return new Promise(function (resolve, reject) {
        spawn(
          elmPackageInstallBin,
          [],
          {
            cwd: context.fullPath
          }
        ).on("close", function (code) {
          if (code != 0) {
            console.error("Runtime error while installing elm packages:", elmPackageInstallBin, { errorCode: code })
            reject("Elm github install failed")
          } else {
            resolve(context)
          }
        }).on("error", function (e) {
          console.error("Unable to run elm package installer:", elmPackageInstallBin, e)
          reject("Unable to install packages")
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
            reject("Compile failed, elm-make returned an error")
          } else {
            resolve(context)
          }
        }).on("error", function (e) {
          console.error("Unable to run elm-make:", e)
          reject("Elm-make failed to execute")
        })
      })
    }

    var uploadResult = function (context) {
      return new Promise(function (resolve, reject) {
        bucket
          .upload(path.resolve(context.fullPath, "main.js"), {
            destination: "snippets/" + job.snippetId + "/main.js"
          }).then(function () {
            resolve(context)
          }).catch(function (err) {
            console.error("Unable to upload result:", err)
            reject("Unable to upload compiled elm script")
          })
      })
    }

    var updateSnippet = function (context) {
      return new Promise(function (resolve, reject) {
        admin
          .database()
          .ref("snippets")
          .child(job.snippetId)
          .update({ compiledAt: Date.now(), updatedAt: Date.now() })
          .then(function () {
            resolve(context)
          })
          .catch(function (e) {
            console.error("Couldn't update snippet:", e)
            reject("Unable to update the snippet")
          })
      })
    }

    return setState("begin", 0, null)
      .then(validateUser)
      .then(setState.bind(this, "sync", 5))
      .then(tempContainer)
      .then(setState.bind(this, "sync", 10))
      .then(downloadPackageJson)
      .then(setState.bind(this, "sync", 15))
      .then(downloadMain)
      .then(setState.bind(this, "sync", 20))
      .then(elmPackageInstall)
      .then(setState.bind(this, "packages", 30))
      .then(compile)
      .then(setState.bind(this, "compile", 90))
      .then(uploadResult)
      .then(setState.bind(this, "end", 95))
      .then(updateSnippet)
      .then(function () {
        return new Promise(function (resolve, reject) {
          jobRef
            .remove()
          resolve("end")
        })
      })
      .catch(function (e) {
        console.error(e)
        jobRef
          .update({ state: "error", error: e })
      })
})
