import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const client = new admin.firestore.v1.FirestoreAdminClient()
const bucket = 'gs://github-tracker-backups'
// The repos/<repo>/data collections are the only collection that
// contain meaningful data for backups. The stats collection is
// completely ephemeral as the data is updated every 15 minutes.
const collections = ['data']

export const backup = functions.pubsub
  // Backs up the whole Firestore database (repos collection) once per week.
  .schedule('0 0 * * 0')
  .onRun(async () => {
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
