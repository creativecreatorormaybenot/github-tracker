import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const client = new admin.firestore.v1.FirestoreAdminClient()
const bucket = 'gs://github-tracker-backups'
// The repos collection is the only collection that contains
// meaningful data for backups. The stats collection is completely
// ephemeral as the data is updated every 15 minutes.
const collections = ['repos']

export const backup = functions.pubsub
  .schedule('0 0 */15 * *')
  .onRun(async (context) => {
    const projectId =
      process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT
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
        : `collections [${collections.join(', ')}]`
    functions.logger.info(
      `Exporting everything from ${collectionNames} ` +
        `in ${databaseName} to ${bucket} ` +
        `with the operation name "${response['name']}".`
    )
  })
