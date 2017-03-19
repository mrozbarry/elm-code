## Elm code

This is a backend process for compiling elm projects given a template zip file and a source file.

## Setup and configuration

This section assumes you have created a firebase project created.

### Tooling

```
$ npm install -g yarn
$ yarn global add firebase-tools
```

## Creating your database

```
$ firebase login
$ firebase init
$ firebase deploy --only database
$ yarn db:seed
```

### Configuration files

 1. Copy `config/services/firebase.example.json` to `config/services/firebase.json` and fill in your firebase information (Overview > Add Firebase to your web app)
 2. Create a service account json file from your firebase project permissions page. Copy that file into `config/services/serviceAccount.json`.

### Prepping firebase

 1. `yarn db:seed` will completely clear your database and storage, and create an initial core package. Do not run this if this is your production server and there is data!
