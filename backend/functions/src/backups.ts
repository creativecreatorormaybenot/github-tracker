import * as functions from 'firebase-functions'
import * as firestore from '@google-cloud/firestore'

const bucket = 'gs://github-tracker-backups'
// The repos collection is the only collection that contains
// meaningful data for backups. The stats collection is completely
// ephemeral as the data is updated every 15 minutes.
// const collections = ['repos']
// Export all collections for now for two reason:
// 1. Cannot forget to add new collections to the backups :)
// 2. It should be "fun" to see a snapshot of the stats collection
//    in backups and it basically contains no data (size-wise)
//    anyway, which is why we are fine.
const collections: string[] = []

export const scheduledFirestoreExport = functions.pubsub
  .schedule('0 0 */15 * *')
  .onRun(async (context) => {
    const projectId =
      process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT
    const client = new firestore.v1.FirestoreAdminClient()
    const databaseName = client.databasePath(
      projectId!,
      '(default)'
    )

    const responses = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: bucket,
      collectionIds: collections,
    })

    // Log information on the operation.
    const response = responses[0]
    const collectionNames =
      collections.length === 0
        ? 'all collections'
        : collections.join(', ')
    functions.logger.info(
      `Exporting everything from ${collectionNames} from Firestore ` +
        `with the operation name "${response['name']}".`
    )
  })
