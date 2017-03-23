const path = require("path")
const storage = require("@google-cloud/storage")

const firebase = require("firebase-admin")
const serviceAccount = require("../services/serviceAccount.json")
const config = require("../../public/firebase.json")

const options = {
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: config.databaseURL
}

const app = firebase.initializeApp(options)

const projectId = config.storageBucket.split(".appspot.com")[0]

module.exports = {
  config: config,
  database: app.database,
  storage: function () {
    return storage({
        projectId: projectId,
        keyFilename: path.resolve(__dirname, "../services/serviceAccount.json")
      })
      .bucket(config.storageBucket)
  }
}
