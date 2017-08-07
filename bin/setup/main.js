const managePackages = require("./managePackages.js")

function main (enquirer) {
  enquirer.ask([
    {
      name: "main",
      message: "How do you want to manage your elm-source backend?",
      type: "list",
      choices: [
        "Manage packages",
        {
          name: "Review flagged packages",
          disabled: "Not implemented"
        },
        {
          name: "Review flagged entries",
          disabled: "Not implemented"
        },
        "Exit"
      ]
    }
  ]).then(function (answer) {
    switch (answer.main) {
      case "Manage packages":
        managePackages(enquirer, main)
        break

      case "Review flagged packages":
        main(enquirer)
        break

      case "Review flagged entries":
        main(enquirer)
        break

      case "Exit":
        console.log("To change your elm-source settings, run `yarn setup` at any time.")
        process.exit(0)
        break
    }
  })
}

module.exports = main
