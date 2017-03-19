const path = require("path")
const firebase = require("../config/initializers/firebase.js")

const database = firebase.database()
const bucket = firebase.storage()

database
  .ref()
  .remove()
  .then(function () {
    createStandardPackage(
      require("./seed/standard/elm-package.json"),
      database.ref("packages").push()
    )
  })
  .catch(function (e) {
    console.error(e)
    process.exit(1)
  })


function createStandardPackage (elmPackage, ref) {
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
      }).catch(function () {
        console.error("Problem uploading Main.elm")
        process.exit(1)
      })
    }).catch(function (e) {
      console.error("Problem uploading elm-package.json")
      process.exit(1)
    })
  }).catch(function (e) {
    console.error(e)
    process.exit(1)
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
