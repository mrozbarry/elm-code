// const fs = require("fs")
// const url = require("url")

const Promise = require("promise")
const Enquirer = require("enquirer")
// const ProgressBar = require("progress-bar")
// const request = require("request")
// const requestProgress = require("request-progress")
// const GitHub = require("github-api")
// const firebase = require("../config/initializers/firebase.js")
// const firebaseConfig = require("../public/firebase.json")
//

const enquirer = init()
const main = require("./setup/main.js")
title("Elm Source")
main(enquirer)


process.on("exit", function (exitCode) {
  if (exitCode >= 128) {
    console.log("Hot exit from setup detected")
    console.log("Run `yarn setup` to modify your elm-source server")
  }
})


function init () {
  const enquirer = new Enquirer()

  enquirer.register("list", require("prompt-list"))
  enquirer.register("radio", require("prompt-radio"))
  enquirer.register("checkbox", require("prompt-checkbox"))

  return enquirer
}

function title (name) {
  console.log("=".repeat(name.length + 2))
  console.log(" " + name)
  console.log("=".repeat(name.length + 2))
}

function manageSubscriptions (enquirer) {
  enquirer
    .ask("package-name")
    .then(function (answer) {
      const packageParts = answer["package-name"].split("/")

      const user = packageParts[0]
      const repo = packageParts[1]

      console.log("Retrieving the latest repository tags...")

      const promises = [
        getCachedVersions(user, repo),
        getRemoteVersions(user, repo)
      ]

      return Promise
        .all(promises)
        .then(function (results) {
          const cachedVersions = results[0]
          const tagVersions = results[1]
          const remoteVersions = remoteVersionsToCache(tagVersions)

          const versions = uniq(
            cachedVersions.concat(remoteVersions)
          ).sort().reverse()

          const questionName = [user, repo, "versions"].join("-")

          enquirer
            .ask(
              [{
                name: questionName,
                message: "Subscribe to which versions?",
                type: "checkbox",
                default: cachedVersions,
                choices: versions
              }]
            )
            .then(function (answer) {
              addNewPackageSubscriptions(user, repo, cachedVersions, answer[questionName])
                .then(function () {
                  return removeOldPackageSubscriptions(user, repo, oldVersions, newVersions)
                })
                .then(function () {
                  manageElmPackages(enquirer)
                })

              // cachedVersions
              //   .filter(function (v) {
              //     return !(answer[questionName].indexOf(v) >= 0)
              //   })
              //   .map(function (v) {
              //     // Remove subscription
              //   })
              // console.log("toAdd", versionsToAdd)
              // console.log("toRemove", versionsToRemove)
              // process.exit(1)
            })
        })
    })
}

function addNewPackageSubscriptions (user, repo, oldVersions, newVersions) {
  return new Promise(function (resolve, reject) {
    const promises = newVersions
      .filter(function (v) {
        return !(oldVersions.indexOf(v) >= 0)
      }).map(function (v) {
        return addNewPackageSubscription(user, repo, v)
      })

    Promise
      .all(promises)
      .then(resolve)
      .catch(reject)
  })
}

function removeOldPackageSubscriptions (user, repo, oldVersions, newVersions) {
  return new Promise(function (resolve, reject) {
    const promises = oldVersions
      .filter(function (v) {
        return !(newVersions.indexOf(v) >= 0)
      }).map(function (v) {
        return removeOldPackageSubscription(user, repo, v)
      })

    Promise
      .all(promises)
      .then(resolve)
      .catch(reject)
  })
}

function addNewPackageSubscription (user, repo, version) {
  return new Promise(function (resolve, reject) {
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .child(user)
      .child(repo)
      .child(version)
      .set({
        bucket: firebaseConfig.storageBucket,
        syncedVersion: ""
      })
      .then(resolve)
      .catch(reject)
  })
}


function removeOldPackageSubscription (user, repo, version) {
  return new Promise(function (resolve, reject) {
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .child(user)
      .child(repo)
      .child(version)
      .once(function (snapshot) {
        const subscription = snapshot.val()
        return new Promise(function (subResolve, subReject) {
          if (subscription.syncedVersion) {
            firebase
              .storage()
              .file(["", "elm", "packages", user, repo, subscription.syncedVersion + ".zip"].join("/"))
              .delete()
              .then(function () {
                return snapshot.ref().remove()
              })
              .then(subResolve)
              .catch(subReject)
          } else {
            snapshot
              .ref()
              .remove()
              .then(subResolve)
              .catch(subReject)
          }

        })
      })
      .then(resolve)
      .catch(reject)
  })
}

function uniq (arr) {
  return arr
    .reduce(function (unique, item) {
      if (unique.indexOf(item) >= 0) {
        return unique
      }
      return unique.concat(item)
    }, [])
}

function getRemoteVersions (user, repo) {
  return new Promise(function (resolve, reject) {
    const gh = new GitHub()
    gh
      .getRepo(user, repo)
      .listTags(function (err, res, req) {
        if (err) {
          reject()
        } else {
          resolve(res)
        }
      })
  })
}

function remoteVersionsToCache (tags) {
  const versions = tags
    .map(function (tag) {
      return "v" + tag.name.split(".")[0]
    })
  return uniq(versions)
}

function getCachedVersions (user, repo) {
  return new Promise(function (resolve, reject) {
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .child(user)
      .child(repo)
      .once("value", function (snapshot) {
        resolve(Object.keys(snapshot.val()))
      })
      .catch(reject)
  })
}


function packageSubscriptions (enquirer) {
  manageElmPackages(enquirer)
  // enquirer
  //   .ask("package-name")
  //   .then(function (answer) {
  //     const gh = new GitHub()
  //     const packageParts = answer["package-name"].split("/")
  //     const repo = gh.getRepo(packageParts[0], packageParts[1])
  //     repo
  //       .listTags()
  //       .then(function (res) {
  //         const lastFive = res.data.slice(0, 5)
  //         const questionName = packageParts.join("-") + "-tags"
  //         enquirer.question(
  //           questionName,
  //           "Which versions of " + packageParts.join("/") + " should be allowed?",
  //           {
  //             type: "checkbox",
  //             default: lastFive[0].name,
  //             choices: lastFive.map(function (tag) { return tag.name })
  //           }
  //         )
  //         enquirer
  //           .ask(questionName)
  //           .then(function (answer) {
  //             const tags = lastFive.filter(function (tag) { return answer[questionName].indexOf(tag.name) >= 0 })
  //             downloadTagUploadPackage(packageParts[0], packageParts[1], tags, function () {
  //               console.log("Done")
  //               main(enquirer)
  //             })
  //           })
  //       })
  //       .catch(function (err) {
  //         console.log("Unable to find package")
  //         main(enquirer)
  //       })
  //   })
}

function downloadTagUploadPackage (user, repo, remainingTags, done) {
  const tag = remainingTags[0]
  if (!tag) {
    return done()
  }
  downloadFile(tag.zipball_url, tag.name + ".zip")
    .then(function () {
      return uploadPackage (tag.name + ".zip", user, repo, tag.name)
    })
    .then(function () {
      fs.unlink(tag.name + ".zip")
    })
    .then(function () {
      downloadTagUploadPackage(user, repo, remainingTags.slice(1), done)
    })
    .catch(function (e) {
      console.error("Problem syncing package", tag)
      console.dir(e)
    })
}

function downloadFile (fileUrl, dest) {
  return new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(dest)

    console.log()
    const bar = ProgressBar.create(process.stdout)
    bar.update(0)

    requestProgress(
      request(
        fileUrl,
        { followAllRedirects: true
        , headers: {
          "User-Agent": "request/elm-source"
        }
        }
      )
    )
      .on("progress", function (event) {
        bar.update(event.percent)
      })
      .on("error", function (e) {
        file.close(function () {
          fs.unlink(dest)
        })
      })
      .on("end", function () {
        console.log()
        fs.stat(dest, function (err, stats) {
          if (err || !stats.isFile()) {
            reject()
          } else {
            file.close(resolve)
          }
        })
      })
      .pipe(file)
  })
}

function uploadPackage (src, user, repo, version) {
  return new Promise(function (resolve, reject) {
    const bucket = firebase.storage()

    bucket
      .upload(
        src,
        { destination: ["elm", "packages", user, repo, version + ".zip"].join("/")
        }
      )
      .then(resolve)
      .catch(reject)
  })
}


function removePackages (enquirer) {
  console.log("=====================")
  console.log(" Remove a package")
  console.log("=====================")
  enquirer
    .ask("package-name")
    .then(function (answer) {
      console.log(answer)
      main(enquirer)
    })
}
