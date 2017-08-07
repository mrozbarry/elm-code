const addOrRemoveSubscriptions = require("./addOrRemoveSubscriptions.js")
const synchronizePackages = require("./_synchronizePackages.js")

function managePackages (enquirer, onBack) {
  const localOnBack = function (enquirer) {
    return managePackages(enquirer, onBack)
  }

  enquirer.ask([
    {
      name: "packages",
      message: "What do you want to do with your packages",
      type: "list",
      choices: [
        "Add or remove subscriptions",
        "Update subscribed packages",
        "Back"
      ]
    }
  ]).then(function (answer) {
    switch (answer.packages) {
      case "Add or remove subscriptions":
        addOrRemoveSubscriptions(enquirer, localOnBack)
        break

      case "Update subscribed packages":
        synchronizePackages(function () {
          onBack(enquirer)
        })
        break

      case "Back":
        onBack(enquirer)
        break
    }
  })
}

module.exports = managePackages
