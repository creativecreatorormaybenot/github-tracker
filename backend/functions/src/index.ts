import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * Runs every minute.
 */
exports.accountcleanup = functions.pubsub
  .schedule('* * * * *')
  .onRun(async (context) => {
    functions.logger.info(
      `It is ${Date.now()} in the Cloud Functions environment.`
    )
  })
