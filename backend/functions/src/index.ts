import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Octokit } from '@octokit/rest'
import {
  Endpoints,
  GetResponseDataTypeFromEndpointMethod,
} from '@octokit/types'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import Twitter, { TwitterOptions } from 'twitter-lite'
import { contentRepos } from './content-repos'

// Initialize clients that can be initialized synchronously.
admin.initializeApp()
const octokit = new Octokit()
const firestore = admin.firestore()
const secretManager = new SecretManagerServiceClient()
// The Twitter client is initialized asynchronously in the update function
// in order to keep the async code in there and ensure initialization has
// completed.
let twitter: Twitter

type Repo = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.search.repos
>['items'][0]

/**
 * Accesses a secret manager secret.
 *
 * @param name the name of the secret in Google Cloud Secret Manager.
 *
 * @returns the payload of the secret.
 */
async function accessSecret(name: string): Promise<string> {
  const [accessResponse] = await secretManager.accessSecretVersion({
    name: `projects/github-tracker-b5c54/secrets/${name}/versions/latest`,
  })

  const responsePayload = accessResponse.payload!.data!.toString()
  return responsePayload
}

/**
 * Updates the tracker (currently every 15 minutes).
 *
 * This involves three steps:
 * 1. Fetch the top 100 repos and save their data.
 * 2. Update the stats for the top 100 repos.
 * 3. Make the Twitter bot take actions based on that if certain events occur.
 */
exports.update = functions.pubsub
  .schedule('*/42 * * * *')
  .onRun(async (context) => {
    // The start date is only use for logging purposes.
    const start = new Date()

    // Load the Twitter client asynchronously on cold start.
    // The reason we have to do this is in order to ensure that
    // the client is loaded before execution as it depends on secrets
    // that can only be loaded asynchronously from secret manager.
    if (twitter === undefined) {
      const config: TwitterOptions = {
        consumer_key: await accessSecret('TWITTER_APP_CONSUMER_KEY'),
        consumer_secret: await accessSecret('TWITTER_APP_CONSUMER_KEY_SECRET'),
        access_token_key: await accessSecret('TWITTER_APP_ACCESS_TOKEN'),
        access_token_secret: await accessSecret(
          'TWITTER_APP_ACCESS_TOKEN_SECRET'
        ),
      }
      twitter = new Twitter(config)
    }

    // We could also use a Firestore server timestamp instead, however,
    // we want to use the local timestamp here, so that it represents the
    // precise time we made the search request.
    const now = admin.firestore.Timestamp.now()

    // 32986 is the precise amount of stars that exactly only 200 repos
    // had achieved at the time I wrote this code. There were 201 repos
    // that had achieved 32986 stars.
    // We fetch the top 200 repos to get the top 100 software repos because
    // we assume that less than half of the repos are content repos.
    const q = 'stars:>32986',
      sort = 'stars',
      per_page = 100
    const params: Endpoints['GET /search/repositories']['parameters'] = {
      q,
      sort,
      per_page,
    }
    // We assume that the requests are successful and do not care about any
    // other information that comes with the response.
    let repos: Array<Repo> = []
    params.page = 1
    repos = repos.concat((await octokit.search.repos(params)).data.items)
    params.page = 2
    repos = repos.concat((await octokit.search.repos(params)).data.items)

    const softwareRepos = repos.filter(
        (repo) => !contentRepos.includes(repo.full_name)
      ),
      top100 = softwareRepos.slice(0, 100)

    if (top100.length !== 100) {
      functions.logger.warn(
        `Only ${top100.length}/100 repos could be retrieved.`
      )
    }

    // We can savely use one batch for all our operations because
    // batches allow up to 500 operations and we have a max
    // of 300 operations in our batch.
    // The sum consists of 100 normal data writes (creating data docs),
    // 100 stats writes (creating or updating docs), and up to 100
    // stats deletions (deleting docs that are not top 100 anymore).
    const batch = firestore.batch()

    const batchingPromises: Array<Promise<any>> = []
    for (const repo of softwareRepos) {
      const dataCollection = firestore
        .collection('repos')
        // We use the repo ID because we want to make sure that we
        // can handle repo name changes and owner changes.
        .doc(repo.id.toString())
        .collection('data')

      batch.create(dataCollection.doc(), {
        timestamp: now,
        position: softwareRepos.indexOf(repo) + 1,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        owner: {
          id: repo.owner.id,
          login: repo.owner.login,
          html_url: repo.owner.html_url,
          avatar_url: repo.owner.avatar_url,
        },
      })

      const statsPromise = Promise.all([
        getDaysAgoDoc(dataCollection, now, 1),
        getDaysAgoDoc(dataCollection, now, 7),
        getDaysAgoDoc(dataCollection, now, 28),
      ]).then((snapshots) => {
        const [one, seven, twentyEight] = snapshots

        batch.set(firestore.collection('stats').doc(`${repo.id}`), {
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          owner: {
            id: repo.owner.id,
            login: repo.owner.login,
            html_url: repo.owner.html_url,
            avatar_url: repo.owner.avatar_url,
          },
          latest: {
            position: softwareRepos.indexOf(repo) + 1,
            stars: repo.stargazers_count,
          },
          ...(one === undefined
            ? {}
            : {
                '1day': {
                  position: one.get('position'),
                  stars: one.get('stargazers_count'),
                },
              }),
          ...(seven === undefined
            ? {}
            : {
                '7day': {
                  position: seven.get('position'),
                  stars: seven.get('stargazers_count'),
                },
              }),
          ...(twentyEight === undefined
            ? {}
            : {
                '28day': {
                  position: twentyEight.get('position'),
                  stars: twentyEight.get('stargazers_count'),
                },
              }),
        })
      })
      batchingPromises.push(statsPromise)
    }
    // This way we can run all the 300 document gets for the historical
    // stats in parallel and not have the function timeout.
    await Promise.all(batchingPromises)
    await batch.commit()

    tweetTopRepo(repos[0])

    functions.logger.debug(
      `Started update at ${start} and ended at ${new Date()}.`
    )
  })

/**
 * Get a doc that is dated a number of days ago compared to now.
 *
 * @param collection the data collection, where the queried docs have a timestamp field.
 * @param now the timestamp to compare against.
 * @param days the number of days ago the doc should be dated compared to now.
 *
 * @returns undefined if there is no such recorded data or one matching snapshot.
 */
async function getDaysAgoDoc(
  collection: admin.firestore.CollectionReference,
  now: admin.firestore.Timestamp,
  days: number
): Promise<admin.firestore.DocumentSnapshot | undefined> {
  const daysAgoMillis = now.toMillis() - 1000 * 60 * 60 * 24 * days
  const result = await collection
    .where(
      'timestamp',
      '>=',
      admin.firestore.Timestamp.fromMillis(daysAgoMillis)
    )
    .where(
      'timestamp',
      '<',
      // Give one hour of slack in case there was an issue with storing the data.
      // If the data is more than an hour old, we declare it as unusable.
      admin.firestore.Timestamp.fromMillis(daysAgoMillis + 1000 * 60 * 60)
    )
    .limit(1)
    .get()
  return result.docs.length === 0 ? undefined : result.docs[0]
}

/**
 * Posts a tweet about the most starred repo.
 *
 * @param repo the top repo.
 */
async function tweetTopRepo(repo: Repo) {
  const org = (await octokit.orgs.get({ org: repo.owner.login })).data
  let repoTag
  if (org.twitter_username == undefined) {
    repoTag = `*${repo.full_name}*`
  } else {
    repoTag = `@${org.twitter_username} /${repo.name}`
  }

  await twitter.post('statuses/update', {
    status: `
The currently most starred software repo on all of #GitHub is ${repoTag} with ${repo.stargazers_count} stars 🤩

#${repo.name} ${repo.html_url}`,
  })
}
