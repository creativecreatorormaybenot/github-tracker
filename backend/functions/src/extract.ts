import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const firestore = admin.firestore()
const storage = admin.storage()

const bucket = 'gs://github-tracker-freezer'

export const freeze = functions.pubsub
  // Extracts all stored data older than 28 days old from Firestore to
  // a JSON file that is stored a Cloud Storage bucket.
  // We do this in order to reduce the cost of backing up the Firestore
  // data every week.
  // This runs so frequently because we want to keep the JSON files small.
  .schedule('0 */3 * * *')
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
      // Limit to 10k documents to avoid exceeding the memory limit (256 MB).
      // One document seems to be about 1 KB in the data collection. The fetched
      // JavaScript objects will obviously be larger than that.
      // This function runs once a day and we create 1,200 documents every three
      // hours, which means that this limit should always be fine.
      .limit(1e4)
      .get()

    // Store the data in a JSON file.
    const json = JSON.stringify(snapshot.docs.map((doc) => doc.data()))
    const file = storage.bucket(bucket).file(`${Date.now()}.json`)
    await file.save(json)
  })
