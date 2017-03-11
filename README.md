## Elm code

This is a backend process for compiling elm projects given a template zip file and a source file.

## Setup and configuration

  1. Create a firebase database
  2. In firebase storage, create the following directories:
    - templates/
    - entries/
  3. In firebase database, data will be arrange like:
    - compile-queue
      - tasks
        - {id}
          - entryId
            - {entryId}
    - entries
      - {entryId}
        - template
          - nameOfTemplate.zip
    - templates
      - {templateId}
        - description
          - {text}
        - name
          - {text}
        - verified
          - {bool}
  4. In firebase permissions, add a new service account, save the details as json
    - Copy this file into `config/serviceAccount.json`
  5. Create `config/databaseURL.json`
    - Write `{ "databaseURL": "https://YOUR-FIREBASE-DB-NAME.firebaseio.com" }` to the file.
  6. `npm install -g yarn && yarn`
  7. `WORKER_PROJECT_ID=firebaseAppSpotSubdomain yarn worker` (where firebaseAppSpotSubdomain should be whatever is in your firebase http://PROJECT-ID.appspot.com)

## Adding tasks to the compile queue

```
firebase
  .database()
  .ref("compile-queue")
  .child("tasks")
  .push({ entryId: "id of your item in entries/" })
```

## Template .zip files

Your template zip file should contain:
  - `elm-stuff/` (and all subdirectories from elm package install)
  - `elm-package.json`

Do **not** zip these files in a directory, the above parts need to be in the root of the zip.


### Adding an entry to firebase

```
const ref =
  firebase
  .database()
  .ref("entries")
  .push({ template: "templateName.zip" })

firebase
  .storage()
  .ref("entries")
  .child(ref.key)
  .putString("-- Elm source code")
```
