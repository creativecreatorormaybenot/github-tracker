import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const firestore = admin.firestore()
const storage = admin.storage()

const bucket = 'gs://github-tracker-freezer'

export const freeze = functions.pubsub
  // Extracts all stored data older than 28 days old from Firestore to
  // a JSON file that is stored a Cloud Storage bucket.
  // We do this in order to reduce the cost of backing up the Firestore
  // data every week. This is also why this operation happens shortly
  // after the weekly Firestore backup operation.
  .schedule('20 4 * * 0')
  .onRun(async () => {
    const snapshot = await firestore
      .collectionGroup('data')
      .where(
        'timestamp',
        '<',
        admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 28)
        )
      )
      // Limit to 100000 documents to avoid exceeding the memory limit (256 MB).
      // One document seems to be about 1 KB in the data collection.
      .limit(1e5)
      .get()

    // Store the data in a JSON file.
    const json = JSON.stringify(snapshot.docs.map((doc) => doc.data()))
    const file = storage.bucket(bucket).file(`${Date.now()}.json`)
    await file.save(json)
  })
