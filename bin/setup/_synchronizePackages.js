const firebase = require("../../config/initializers/firebase.js")
const GitHub = require("github-api")
const semver = require("semver")
const Progress = require("progress")
const request = require("superagent")
const fs = require("fs")

function synchronizePackages (onComplete) {
  console.log("sync all", onComplete)
  return new Promise(function (resolve, reject) {
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .once("value", function (snapshot) {
        console.log("Enumerating packages")
        resolve(enumeratePackages(snapshot.val()))
      })
      .catch(function (e) {
        console.error(e)
        reject(e)
      })
  }).then(function (packages) {
    console.log("Synchronizing packages...")
    return Promise.all(packages.map(function (package) {
      return synchronizePackage(package)
    }))
  })
  .then(onComplete)
  .catch(function (e) {
    console.error("Unable to synchronize packages:", e)
  })
}

function synchronizePackage (package) {
  const bar = new Progress([package.userName, package.repoName].join("/") + " " + package.majorVersion + " " + " [:bar] :percent :eta", { total: 100 })
  bar.tick(0)

  return new Promise(function (resolve, reject) {
    const gh = new GitHub()

    const repo = gh.getRepo(package.userName, package.repoName)

    repo.listTags(function (err, tags, req) {
      if (err) return reject(err)

      const targetVersion = parseInt(package.majorVersion.slice(1), 10)

      const matchingVersions = tags.filter(function (tag) {
        const majorVersion = parseInt(tag.name.split(".")[0], 10)
        return majorVersion == targetVersion
      })

      const latest = matchingVersions[0]

      const notSynced = !package.syncedToVersion || package.syncedToVersion === ""
      const needsUpdate = !notSynced && semver.lt(package.syncedToVersion, latest.name)

      if (needsUpdate) {
        firebase
          .storage()
          .bucket(package.bucket)
          .file(["", "elm", "packages", package.userName, package.repoName, package.syncedToVesion + ".zip"].join("/"))
          .delete(function (err) {
            console.error("Synchronize packages:", { package: package, error: err })
          })
      }

      if (notSynced || needsUpdate) {
        const zipFile = fs.createWriteStream(latest.name + ".zip")

        zipFile.on("finish", function () {
          bar.tick(50)
          firebase
            .storage()
            .upload(latest.name + ".zip", {
              destination: ["elm", "packages", package.userName, package.repoName, latest.name + ".zip"].join("/")
            })
            .then(function () {
              bar.tick(90)
              fs.unlink(latest.name + ".zip", function () {
                bar.tick(95)
                firebase
                  .database()
                  .ref("elm")
                  .child("packages")
                  .child(package.userName)
                  .child(package.repoName)
                  .child(package.majorVersion)
                  .child("syncedToVersion")
                  .set(latest.name)
                  .then(function () {
                    bar.tick(100)
                    console.log()
                  })
                  .then(resolve)
                  .catch(reject)
              })
            })
        })

      } else {
        resolve()
      }
    })
  })
}

function enumeratePackages (packages) {
  console.dir(packages)
  return Object.keys(packages).reduce(function (enumerated, userName) {
    return enumerated.concat(
      Object.keys(packages[userName]).reduce(function (userRepos, repoName) {
        return userRepos.concat(
          Object.keys(packages[userName][repoName]).reduce(function (versionRepos, majorVersion) {
            return versionRepos.concat({
              userName: userName,
              repoName: repoName,
              majorVersion: majorVersion,
              syncedToVersion: packages[userName][repoName][majorVersion].syncedToVersion,
              bucket: packages[userName][repoName][majorVersion].bucket
            })
          }, [])
        )
      }, [])
    )
  }, [])
}

module.exports = synchronizePackages
