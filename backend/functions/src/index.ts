import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { Octokit } from '@octokit/rest'
import {
  Endpoints,
  GetResponseDataTypeFromEndpointMethod,
} from '@octokit/types'
import Twitter, { TwitterOptions } from 'twitter-lite'
import numbro from 'numbro'
import { contentRepos } from './content-repos'
import { milestones } from './milestones'

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

interface RepoData {
  timestamp: admin.firestore.Timestamp
  position: Number
  full_name: String
  description: String
  language: String | null
  html_url: String
  stargazers_count: Number
  owner: {
    id: Number
    login: String
    html_url: String
    avatar_url: String
  }
}

type RepoMetadata = Pick<
  RepoData,
  'timestamp' | 'full_name' | 'description' | 'html_url' | 'owner' | 'language'
> &
  Partial<RepoData>

interface StatsDayData {
  position: Number
  stars: Number
}

interface StatsData {
  metadata: RepoMetadata
  latest: StatsDayData
  oneDay?: StatsDayData
  sevenDay?: StatsDayData
  twentyEightDay?: StatsDayData
}

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
 * Updates the tracker (currently every 30 minutes).
 *
 * This involves three steps:
 * 1. Fetch the top 100 repos and save their data.
 * 2. Update the stats for the top 100 repos.
 * 3. Make the Twitter bot take actions based on that if certain events occur.
 */
exports.update = functions.pubsub
  .schedule('*/30 * * * *')
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
    for (const repo of top100) {
      const dataCollection = firestore
        .collection('repos')
        // We use the repo ID because we want to make sure that we
        // can handle repo name changes and owner changes.
        .doc(repo.id.toString())
        .collection('data')

      const data: RepoData = {
        timestamp: now,
        position: top100.indexOf(repo) + 1,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        owner: {
          id: repo.owner.id,
          login: repo.owner.login,
          html_url: repo.owner.html_url,
          avatar_url: repo.owner.avatar_url,
        },
      }
      batch.create(dataCollection.doc(), data)

      // Create a metadata subset of the repo data that we can include
      // in the stats doc.
      const metadata: RepoMetadata = Object.assign({}, data)
      delete metadata.position
      delete metadata.stargazers_count

      const statsPromise = Promise.all([
        getDaysAgoDoc<RepoData>(dataCollection, now, 1),
        getDaysAgoDoc<RepoData>(dataCollection, now, 7),
        getDaysAgoDoc<RepoData>(dataCollection, now, 28),
        getLatestDoc<RepoData>(dataCollection),
      ]).then(async (snapshots) => {
        const [one, seven, twentyEight, latest] = snapshots

        // Store stats data.
        const statsData: StatsData = {
          metadata,
          latest: {
            position: top100.indexOf(repo) + 1,
            stars: repo.stargazers_count,
          },
          ...(one === undefined
            ? {}
            : {
                oneDay: {
                  position: one.data()!.position,
                  stars: one.data()!.stargazers_count,
                },
              }),
          ...(seven === undefined
            ? {}
            : {
                sevenDay: {
                  position: seven.data()!.position,
                  stars: seven.data()!.stargazers_count,
                },
              }),
          ...(twentyEight === undefined
            ? {}
            : {
                twentyEightDay: {
                  position: twentyEight.data()!.position,
                  stars: twentyEight.data()!.stargazers_count,
                },
              }),
        }
        batch.set(firestore.collection('stats').doc(`${repo.id}`), statsData)

        if (latest !== undefined) {
          // Await tracking milestones for the repo.
          await trackRepoMilestones(repo, latest.data()!)
        }
      })
      batchingPromises.push(statsPromise)
    }
    // This way we can run all the 300 document gets for the historical
    // stats in parallel and not have the function timeout.
    await Promise.all(batchingPromises)
    await batch.commit()

    if (false) {
      // We do not want to spam about the top repo.
      await tweetTopRepo(top100[0])
    }

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
async function getDaysAgoDoc<T>(
  collection: admin.firestore.CollectionReference,
  now: admin.firestore.Timestamp,
  days: number
): Promise<admin.firestore.DocumentSnapshot<T> | undefined> {
  const daysAgoMillis = now.toMillis() - 1000 * 60 * 60 * 24 * days
  const result = await collection
    .where(
      'timestamp',
      '>=',
      // Give thirty seconds of slack for potential function execution deviations.
      admin.firestore.Timestamp.fromMillis(daysAgoMillis - 1000 * 30)
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
  return result.docs.length === 0
    ? undefined
    : (result.docs[0] as admin.firestore.DocumentSnapshot<T>)
}

/**
 * Get the latest doc in the given collection.
 *
 * @param collection the data collection, where the queried docs have a timestamp field.
 *
 * @returns undefined if there is no such recorded data or one matching snapshot.
 */
async function getLatestDoc<T>(
  collection: admin.firestore.CollectionReference
): Promise<admin.firestore.DocumentSnapshot<T> | undefined> {
  const result = await collection.orderBy('timestamp', 'desc').limit(1).get()
  return result.docs.length === 0
    ? undefined
    : (result.docs[0] as admin.firestore.DocumentSnapshot<T>)
}

/**
 * Generates a repo tag for the given repo that will include the organization's Twitter
 * tag if available and the repo's full name otherwise.
 *
 * @param repo the repo data.
 *
 * @returns a string repo tag.
 */
async function getRepoTag(repo: Repo): Promise<String> {
  const org = (await octokit.orgs.get({ org: repo.owner.login })).data
  let repoTag
  if (org.twitter_username === null) {
    repoTag = `*${repo.full_name}*`
  } else {
    repoTag = `@${org.twitter_username} /${repo.name}`
  }
  return repoTag
}

/**
 * Posts a tweet about the most starred repo.
 *
 * @param repo the top repo.
 */
async function tweetTopRepo(repo: Repo) {
  const repoTag = await getRepoTag(repo)
  functions.logger.info(
    `Tweeting about top repo ${repoTag} at ${repo.stargazers_count} stars.`
  )

  const formattedStars = numbro(repo.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  })
  let ownerHashtag = ''
  if (!repoTag.startsWith('@') && repo.name !== repo.owner.login) {
    ownerHashtag = ` #${repo.owner.login}`
  }
  await twitter.post('statuses/update', {
    status: `
The currently most starred software repo on #GitHub is ${repoTag} with ${formattedStars} 🌟

#${repo.name}${ownerHashtag} #${repo.language}
${repo.html_url}`,
  })
}

/**
 * Checks the given repo for having passed any milestones by comparing the
 * current repo data to the latest stored data.
 *
 * @param repo the current repo data from GitHub.
 * @param latest the latest data we have stored about the repo.
 */
async function trackRepoMilestones(repo: Repo, latest: RepoData) {
  const previousStars: Number = latest.stargazers_count
  const currentStars = repo.stargazers_count

  if (currentStars < previousStars) return

  for (const milestone of milestones) {
    if (currentStars < milestone) break
    if (previousStars >= milestone) continue

    const repoTag = await getRepoTag(repo)
    functions.logger.info(
      `Tweeting about ${repoTag} reaching the ${milestone} milestone.`
    )

    const formattedMilestone = numbro(milestone).format({
      average: true,
      mantissa: 3,
      optionalMantissa: true,
    })
    let ownerHashtag = ''
    if (!repoTag.startsWith('@') && repo.name !== repo.owner.login) {
      ownerHashtag = ` #${repo.owner.login}`
    }
    // Tweet about milestone.
    await twitter.post('statuses/update', {
      status: `
The ${repoTag} repo just crossed the ${formattedMilestone} 🌟 milestone on #GitHub 🎉

Way to go and congrats on reaching this epic milestone 💪 #${repo.name}${ownerHashtag} #${repo.language}
${repo.html_url}
`,
    })
    return
  }
}
