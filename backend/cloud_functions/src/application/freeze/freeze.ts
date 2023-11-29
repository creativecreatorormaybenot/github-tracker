import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as v1 from 'firebase-functions/v1';

const bucket = 'gs://github-tracker-freezer';

/**
 * Extracts all stored data older than 31 days old from Firestore to
 * a JSON file that is stored in a Cloud Storage bucket.
 * We choose 31 days over 28 days since we want to track the fastest growing
 * repo of the month at the end of each month.
 * We do this in order to reduce the cost of backing up the Firestore
 * data every week.
 * This runs so frequently because we want to keep the JSON files small.
 */
export const freezeDataFunction = v1
  .region('us-central1')
  .pubsub.schedule('0 */3 * * *')
  .onRun(async (context) => {
    const firestore = getFirestore();
    const storage = getStorage();
    const snapshot = await firestore
      .collectionGroup('data')
      .where(
        'timestamp',
        '<',
        Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 31))
      )
      // Limit to 10k documents to avoid exceeding the memory limit (256 MB).
      // One document seems to be about 1 KB in the data collection. The fetched
      // JavaScript objects will obviously be larger than that.
      // This function runs once a day and we create 1,200 documents every three
      // hours, which means that this limit should always be fine.
      .limit(1e4)
      .get();
    if (snapshot.docs.length === 0) {
      console.info('No old data to extract.');
      return;
    }

    // The documents are sorted by timestamp in ascending order.
    const lastTime = snapshot.docs[snapshot.docs.length - 1].data()
      .timestamp as Timestamp;
    const earliestTime = snapshot.docs[0].data().timestamp as Timestamp;

    // Make sure to map the data by repo ID, so that we can access it properly later.
    const data: {
      [key: string]: any;
    } = {};
    for (const doc of snapshot.docs) {
      const repoId = doc.ref.parent.parent!.id;
      if (!data[repoId]) {
        data[repoId] = [];
      }
      data[repoId].push(doc.data());
    }

    // Store the data in a JSON file.
    const json = JSON.stringify(data);
    const file = storage
      .bucket(bucket)
      .file(
        `${earliestTime.toMillis()}-${lastTime.toMillis()}@${Date.now()}.json`
      );
    await file.save(json);
    console.info(
      `Extracted ${
        snapshot.docs.length
      } documents (from ${earliestTime.toDate()} to ${lastTime.toDate()}).`
    );

    const batches: Array<WriteBatch> = [];
    let i = 0;
    for (const doc of snapshot.docs) {
      if (i % 500 === 0) {
        // Delete the documents in batches of 500 (as this is the transaction write limit).
        batches.push(firestore.batch());
      }
      batches[batches.length - 1].delete(doc.ref);
      i++;
    }

    // Once saving of the document data has succeeded, we can delete the redundant documents.
    await Promise.all([...batches.map((batch) => batch.commit())]);
    console.info('Successfully deleted all documents from Firestore.');
  });
