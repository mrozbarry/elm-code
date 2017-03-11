const firebase = require("firebase-admin")
const config = require("../serviceAccount.json")
const database = require("../database.json")

const options = {
  credential: firebase.credential.cert(config),
  databaseURL: database.databaseURL
}

module.exports = firebase.initializeApp(options)
