const path = require("path")
const firebase = require("../config/initializers/firebase.js")

const database = firebase.database()
const bucket = firebase.storage()

database
  .ref()
  .remove()
  .then(function () {
    bucket.deleteFiles().then(function () {
      const package = createStandardPackage(
        require("./seed/standard/elm-package.json")
      )

      const demoUser = createDemoUser()

      const demoSnippet = createDemoSnippet(demoUser.key, package.key)

      createTask(demoUser.key, demoSnippet.key, package.key)

    }).catch(function (e) {
      console.error(e)
      process.exit(1)
    })
  })
  .catch(function (e) {
    console.error(e)
    process.exit(1)
  })




function createStandardPackage (elmPackage) {
  const ref = database.ref("packages").push()
  const key = ref.key

  ref.set({
    name: "Standard Core/Html App",
    dependencies: replaceObjectKeySlashWithPipe(elmPackage.dependencies),
    flagged: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }).then(function () {
    bucket.upload(
      path.resolve(__dirname, "seed", "standard", "elm-package.json"),
      {
        destination: "packages/" + key + "/elm-package.json"
      }
    ).then(function () {
      bucket.upload(
        path.resolve(__dirname, "seed", "standard", "Main.elm"),
        {
          destination: "packages/" + key + "/Main.elm"
        }
      ).then(function () {
        process.exit(0)
      }).catch(function (e) {
        console.error(e)
        process.exit(1)
      })
    }).catch(function (e) {
      console.error(e)
      process.exit(1)
    })
  }).catch(function (e) {
    console.error(e)
    process.exit(1)
  })

  return ref
}

function createDemoUser () {
  const ref = database.ref("users").push()

  ref.set({ isBanned: false, snippetCount: 0, createdAt: Date.now() })

  return ref
}

function createDemoSnippet(userId, packageId) {
  const ref = database.ref("snippets").push()
  const key = ref.key

  const dest = "snippets/" + key + "/Main.elm"

  ref.set({
    userId: userId,
    packageId: packageId,
    title: "Demo seed snippet",
    attribution: "[Elm-Canvas](https://github.com/Elm-Canvas)",
    description: "Just a demo snippet to test that the system works",
    isPublic: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }).then(function () {
    console.log("createDemoSnippet: ", dest)
    bucket.upload(
      path.resolve(__dirname, "seed", "standard", "Main.elm"),
      {
        destination: dest
      }
    )
    .then(function () {
      console.log("Successfully uploaded to", dest)
    })
    .catch(function (e) {
      console.error("Unable to create new snippet Main.elm:", e)
      process.exit(1)
    })
  })

  return ref
}

function createTask (userId, snippetId, packageId) {
  const ref = database.ref("compile-queue").child("tasks").child(snippetId)

  ref.set({
    snippetId: snippetId,
    packageId: packageId,
    userId: userId
  })
}

function replaceObjectKeySlashWithPipe (obj) {
  const keys = Object.keys(obj)

  return keys.reduce(function (nextObj, key) {
    return Object.assign({}, nextObj, {
      [key.replace("/", "|")]: obj[key]
    })
  }, {})
}
