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
    if (snapshot.docs.length === 0) {
      functions.logger.info('No old data to extract.')
      return
    }

    // The documents are sorted by timestamp in ascending order.
    const lastTime = snapshot.docs[snapshot.docs.length - 1].data()
      .timestamp as admin.firestore.Timestamp
    const earliestTime = snapshot.docs[0].data()
      .timestamp as admin.firestore.Timestamp

    // Make sure to map the data by repo ID, so that we can access it properly later.
    const data: {
      [key: string]: any
    } = {}
    for (const doc of snapshot.docs) {
      const repoId = doc.ref.parent.parent!.id
      if (!data[repoId]) {
        data[repoId] = []
      }
      data[repoId].push(doc.data())
    }

    // Store the data in a JSON file.
    const json = JSON.stringify(data)
    const file = storage
      .bucket(bucket)
      .file(
        `${earliestTime.toMillis()}-${lastTime.toMillis()}@${Date.now()}.json`
      )
    await file.save(json)
    functions.logger.info(
      `Extracted ${
        snapshot.docs.length
      } documents (from ${earliestTime.toDate()} to ${lastTime.toDate()}).`
    )

    const batches: Array<admin.firestore.WriteBatch> = []
    let i = 0
    for (const doc of snapshot.docs) {
      if (i % 500 === 0) {
        // Delete the documents in batches of 500 (as this is the transaction write limit).
        batches.push(firestore.batch())
      }
      batches[batches.length - 1].delete(doc.ref)
      i++
    }

    // Once saving of the document data has succeeded, we can delete the redundant documents.
    await Promise.all([...batches.map((batch) => batch.commit())])
    functions.logger.info('Successfully deleted all documents from Firestore.')
  })
