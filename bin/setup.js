const fs = require("fs")
const url = require("url")

const Promise = require("promise")
const Enquirer = require("enquirer")
const ProgressBar = require("progress-bar")
const request = require("request")
const requestProgress = require("request-progress")
const GitHub = require("github-api")
const firebase = require("../config/initializers/firebase.js")


const enquirer = init()
main(enquirer)


function init () {
  const enquirer = new Enquirer()

  enquirer.register("radio", require("prompt-radio"))
  enquirer.register("checkbox", require("prompt-checkbox"))

  enquirer.question(
    "root-action",
    "How do you want to manage your elm-source backend?",
    {
      type: "radio",
      default: "Add elm packages",
      choices: [
        "Add elm packages",
        "Remove elm packages",
        "Exit"
      ]
    }
  )

  enquirer.question(
    "package-name",
    {
      message: "Enter package name (ie owner/repo)",
      default: "elm-lang/core"
    }
  )

  return enquirer
}


function main (enquirer) {
  enquirer
    .ask("root-action")
    .then(function (answer) {
      switch (answer["root-action"]) {
      case "Add elm packages":
        addPackages(enquirer)
        break
      case "Remove elm packages":
        removePackages(enquirer)
        break
      case "Exit":
        process.exit(0)
      }
    })
}


function addPackages (enquirer) {
  console.log("=====================")
  console.log(" Add a package")
  console.log("=====================")
  enquirer
    .ask("package-name")
    .then(function (answer) {
      const gh = new GitHub()
      const packageParts = answer["package-name"].split("/")
      const repo = gh.getRepo(packageParts[0], packageParts[1])
      repo
        .listTags()
        .then(function (res) {
          const lastFive = res.data.slice(0, 5)
          const questionName = packageParts.join("-") + "-tags"
          enquirer.question(
            questionName,
            "Which versions of " + packageParts.join("/") + " should be allowed?",
            {
              type: "checkbox",
              default: lastFive[0].name,
              choices: lastFive.map(function (tag) { return tag.name })
            }
          )
          enquirer
            .ask(questionName)
            .then(function (answer) {
              const tags = lastFive.filter(function (tag) { return answer[questionName].indexOf(tag.name) >= 0 })
              downloadTagUploadPackage(packageParts[0], packageParts[1], tags, function () {
                console.log("Done")
                main(enquirer)
              })
            })
        })
        .catch(function (err) {
          console.log("Unable to find package")
          main(enquirer)
        })
    })
}

function downloadTagUploadPackage (user, repo, remainingTags, done) {
  const tag = remainingTags[0]
  if (!tag) {
    return done()
  }
  downloadFile(tag.zipball_url, tag.name + ".zip")
    // .then(function () {
    //   return uploadPackage (tag.name + ".zip", user, repo, tag.name)
    // })
    // .then(function () {
    //   fs.unlink(tag.name + ".zip")
    // })
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

    console.log(fileUrl)

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
