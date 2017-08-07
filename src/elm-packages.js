const Promise = require("promise")
const GitHub = require("github-api")
const semver = require("semver")
const request = require("superagent")
const fs = require("fs")
const firebase = require("../config/initializers/firebase.js")

function getRef (firebase, userName, repoName) {
  return Promise.resolve(
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .child(userName)
      .child(repoName)
  )
}

function getMajorVersions (packageRef) {
  return new Promise(function (resolve, reject) {
    packageRef.once("value", function (snapshot) {
      const packageVersions = snapshot.val()
      resolve(Object.keys(packageVersions))
    })
  })
  .catch(reject)
}

function getMajorVersionRef (packageRef, majorVersion) {
  return Promise.resolve(
    packageRef.child(majorVersion)
  )
}

function setSubscriptionTo (packageRef, majorVersion) {
  return new Promise(function (resolve, reject) {
    packageRef
      .child(majorVersion)
      .set({
        bucket: firebase.config.storageBucket,
        state: "new"
      })
      .then(resolve)
      .catch(reject)
  })
}

function removeSubscriptionTo (packageRef, majorVersion) {
  return new Promise(function (resolve, reject) {
    packageRef
      .child(majorVersion)
      .update({
        bucket: firebase.config.storageBucket,
        state: "queuedForRemoval"
      })
      .then(resolve)
      .catch(reject)
  })
}

function update (packageRef, majorVersion) {
  return new Promise(function (resolve, reject) {
    packageRef
      .child(majorVersion)
      .on("value", function (snapshot) {
        const packageVersion = snapshot.val()
        switch (packageVersion.state) {

          case "synced":
            // Uninstall if there is a new version

          case "new":
            resolve(
              updateInstallPackage(packageRef, majorVersion, packageVersion)
            )
            break

          case "queuedForRemoval"
            break
        }
      })
  })
}

function updateHasNewerVersion (majorVersion, package) {
  return new Promise(function (resolve, reject) {
    const gh = new GitHub()
    try {
      const repo = gh.getRepo(package.userName, package.repoName)

      repo.listTags(function (err, tags) {
        if (err) {
          reject(err)
        } else {
          const targetVersion = parseInt(package.majorVersion.slice(1), 10)

          const matchingVersions = tags.filter(function (tag) {
            const majorVersion = parseInt(tag.name.split(".")[0], 10)
            return majorVersion == targetVersion
          })

          const latest = matchingVersions[0]
          const currentVersion = package.syncedToVersion || "0.0.0"

          resolve({ hasUpdate: semver.lt(currentVersion, latest.name), latest: latest })
        }
      })
    } catch (e) {
      console.error("Could not open github repo:", [package.userName, package.repoName].join("/"), e)
      reject(e)
    }
  })
}

function updateUninstallPackage (packageRef, majorVersion, package) {
  return new Promise(function (resolve, reject) {
    firebase
      .storage()
      .file(["elm", "packages", package.userName, package.repoName, package.syncedToVersion + ".zip"].join("/"))
      .delete(function () {
        packageRef
          .child(majorVersion)
          .child("syncedToVersion")
          .remove()
          .then(resolve)
          .catch(resolve)
      })
  })
}

function updateInstallPackage (packageRef, majorVersion, package) {
  return new Promise(function (resolve, reject) {
    updateHasNewerVersion(majorVersion, package)
      .then(function (packageUpdate) {
        const hasUpdate = packageUpdate.hasUpdate
        const latestTag = packageUpdate.latest

        if (hasUpdate) {
          resolve(latestTag)
        } else {
          resolve()
        }
      })
      .catch(reject)
  })
  .then(function (tag) {
    return new Promise(function (resolve, reject) {
      if (!tag) return reject("Tag not found")

      const fileStream = fs.createWriteStream(latest.name + ".zip")

      fileStream.on("finish", function () {
        resolve(tag)
      })

      request
        .get(tag.zipball_url)
        .set("User-Agent", "elm-source/package-sync")
        .on("error", function (err) {
          console.error("Could not synchronize package:", err)
          reject(err)
        })
        .pipe(fileStream)
    })
  })
  .then(function (tag) {
    return new Promise(function (resolve, reject) {
      firebase
        .storage()
        .upload(
          tag.name ".zip",
          {
            destination: ["elm", "packages", package.userName, package.repoName, tag.name + ".zip"].join("/")
          },
          function (err, file) {
            if (err) {
              reject(err)
            } else {
              resolve(tag)
            }
          }
        )
    })

  })
  .then(function (tag) {
    return new Promise(function (resolve, reject) {
      fs.unlink(tag.name + ".zip", function () {
        resolve()
      })
    })
  })
}
