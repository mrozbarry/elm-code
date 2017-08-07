const firebase = require("../../config/initializers/firebase.js")
const GitHub = require("github-api")

function addOrRemoveSubscriptions (enquirer, onBack) {
  enquirer.ask([
    {
      name: "packageName",
      message: "Enter package name (ie owner/repo)",
      default: "elm-lang/core"
    }
  ]).then(function (answer) {
    if (!(/[a-z0-9]+\/[a-z0-9]+$/i.test(answer.packageName))) {
      console.log("Package name format did not match `user/repo`!")
      return onBack(enquirer)
    }
    const packageParts = answer.packageName.split("/")
    const userName = packageParts[0]
    const repoName = packageParts[1]

    const gh = new GitHub()
    const repo = gh.getRepo(userName, repoName)

    return selectVersions(enquirer, userName, repoName, repo, onBack)
  })
}

function selectVersions (enquirer, userName, repoName, repo, onBack) {
  return Promise.all([
    getRemoteVersions(repo),
    getCachedVersions(userName, repoName)
  ]).then(function (remoteAndCachedVersions) {
    const remoteVersions = remoteAndCachedVersions[0]
    const remoteVersionsByMajor = remoteVersions.reduce(function (grouped, version) {
      const major = "v" + version.name.split(".")[0]
      if (grouped[major]) {
        grouped[major] = grouped[major].concat(version)
      } else {
        grouped[major] = [version]
      }
      return grouped
    }, {})
    const cachedVersions = remoteAndCachedVersions[1]

    const questionName = [userName, repoName, "tags"].join("-")

    console.warn("Older tags are automatically removed - always try and keep your packages up to date.")

    enquirer.ask([
      {
        name: questionName,
        message: "Which versions of " + [userName, repoName].join("/") + " should be allowed?",
        type: "checkbox",
        default: cachedVersions,
        choices: Object.keys(remoteVersionsByMajor)
      }
    ]).then(function (answer) {
      return Promise.resolve(answer[questionName])
    }).then(function (approvedVersions) {
      console.log(approvedVersions)
      onBack(enquirer)

      // TODO: Add/remove packages based on selections
    })
  }).catch(function (e) {
    console.error("I ran into an error loading package versions!", e)
    onBack(enquirer)
  })
}

function getRemoteVersions (repo) {
  console.log("Retrieving tagged versions from github...")
  return new Promise(function (resolve, reject) {
    repo.listTags(function (err, res, req) {
      if (err) {
        console.error("Could not retrieve tagged versions, perhaps you mistyped the repository?")
        reject()
      } else {
        resolve(res)
      }
    })
  })
}

function getCachedVersions (userName, repoName) {
  console.log("Retrieving cached versions from firebase...")
  return new Promise(function (resolve, reject) {
    firebase
      .database()
      .ref("elm")
      .child("packages")
      .child(userName)
      .child(repoName)
      .once("value", function (snapshot) {
        resolve(Object.keys(snapshot.val()))
      })
      .catch(function () {
        console.warn("Unable to find cached versions")
        resolve([])
      })
  })
}

module.exports = addOrRemoveSubscriptions
