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
  position: number
  full_name: string
  description: string
  language: string | null
  html_url: string
  stargazers_count: number
  owner: {
    id: number
    login: string
    html_url: string
    avatar_url: string
  }
}

type RepoMetadata = Pick<
  RepoData,
  'timestamp' | 'full_name' | 'description' | 'html_url' | 'owner' | 'language'
> &
  Partial<RepoData>

interface StatsDayData {
  position: number
  stars: number
}

interface StatsData {
  metadata: RepoMetadata
  latest: StatsDayData
  oneDay?: StatsDayData
  sevenDay?: StatsDayData
  twentyEightDay?: StatsDayData
}

function snapshotConverter<T>(): admin.firestore.FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): admin.firestore.DocumentData {
      return data
    },
    fromFirestore(snapshot: admin.firestore.QueryDocumentSnapshot): T {
      return snapshot.data() as T
    },
  }
}

function typedCollection<T>(
  path: string
): admin.firestore.CollectionReference<T> {
  return admin
    .firestore()
    .collection(path)
    .withConverter(snapshotConverter<T>())
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
 * Updates the tracker (currently every 15 minutes).
 *
 * This involves three steps:
 * 1. Fetch the top 100 repos and save their data.
 * 2. Update the stats for the top 100 repos.
 * 3. Make the Twitter bot take actions based on that if certain events occur.
 */
exports.update = functions.pubsub
  .schedule('*/15 * * * *')
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

    // We need to make sure that we do not surpass the 500 operations write
    // limit for batch writes. This is why we create a function for dynamically
    // retrieving write batches.
    // At this time, we have at least 100 writes for storing the repo data and 100
    // updates for updating the stats data. However, we cannot know how many deletes
    // we have (as the old data might be faulty). Furthermore, this approach ensures
    // that we can add batch operations later on :)
    const batches: admin.firestore.WriteBatch[] = []
    let opIndex = 0
    function batch(): admin.firestore.WriteBatch {
      if (opIndex % 500 === 0) {
        batches.push(firestore.batch())
      }
      opIndex++

      return batches[batches.length - 1]
    }

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

    const batchingPromises: Array<Promise<any>> = []
    for (const repo of top100) {
      const dataCollection = firestore
        .collection('repos')
        // We use the repo ID because we want to make sure that we
        // can handle repo name changes and owner changes.
        .doc(repo.id.toString())
        .collection('data')
        .withConverter(snapshotConverter<RepoData>())

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
      batch().create(dataCollection.doc(), data)

      // Create a metadata subset of the repo data that we can include
      // in the stats doc.
      const metadata: RepoMetadata = Object.assign({}, data)
      delete metadata.position
      delete metadata.stargazers_count

      const statsPromise = Promise.all([
        getDaysAgoDoc(dataCollection, now, 1),
        getDaysAgoDoc(dataCollection, now, 7),
        getDaysAgoDoc(dataCollection, now, 28),
        getLatestDoc(dataCollection),
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
        batch().set(
          typedCollection<StatsData>('stats').doc(`${repo.id}`),
          statsData
        )

        if (latest !== undefined) {
          // Await tracking milestones for the repo.
          await trackRepoMilestones(repo, latest.data()!)
        }
      })
      batchingPromises.push(statsPromise)
    }

    // Remove stats docs for repos that are not currently in the top 100.
    const currentStatsReposPromise = typedCollection<StatsData>('stats')
      .listDocuments()
      .then((currentStatsRepos) => {
        const top100Ids = top100.map((repo) => repo.id.toString())
        for (const repo of currentStatsRepos) {
          if (!top100Ids.includes(repo.id)) {
            batch().delete(repo)
          }
        }
      })
    batchingPromises.push(currentStatsReposPromise)

    // This way we can run all the 400 document gets for the historical
    // stats in parallel and not have the function timeout.
    await Promise.all(batchingPromises)
    // Additionally, we can commit the potentially multiple batches in
    // parallel as well.
    await Promise.all(batches.map((b) => b.commit()))

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
  collection: admin.firestore.CollectionReference<T>,
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
    .withConverter(snapshotConverter<T>())
    .get()
  return result.docs.length === 0 ? undefined : result.docs[0]
}

/**
 * Get the latest doc in the given collection.
 *
 * @param collection the data collection, where the queried docs have a timestamp field.
 *
 * @returns undefined if there is no such recorded data or one matching snapshot.
 */
async function getLatestDoc<T>(
  collection: admin.firestore.CollectionReference<T>
): Promise<admin.firestore.DocumentSnapshot<T> | undefined> {
  const result = await collection
    .orderBy('timestamp', 'desc')
    .limit(1)
    .withConverter(snapshotConverter<T>())
    .get()
  return result.docs.length === 0 ? undefined : result.docs[0]
}

/**
 * Generates a repo tag for the given repo that will include the organization's Twitter
 * tag if available and the repo's full name otherwise.
 *
 * @param repo the repo data.
 *
 * @returns a string repo tag.
 */
async function getRepoTag(repo: Repo): Promise<string> {
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
 * Generates a strings of hashtags based on the given repo.
 *
 * @param repo the repo data.
 *
 * @returns a string of one or more space-separated hashtags.
 */
function getHashtags(repo: Repo): string {
  const hashtags = [`#${repo.owner.login}`]
  if (repo.owner.login !== repo.name) {
    hashtags.push(`#${repo.name}`)
  }
  if (
    repo.language !== null &&
    repo.language !== repo.owner.login &&
    repo.language !== repo.name
  ) {
    hashtags.push(`#${repo.language}`)
  }
  return hashtags.join(' ')
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
  await twitter.post('statuses/update', {
    status: `
The currently most starred software repo on #GitHub is ${repoTag} with ${formattedStars} 🌟

${getHashtags(repo)}
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
  const previousStars: number = latest.stargazers_count
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
    // Tweet about milestone.
    await twitter.post('statuses/update', {
      status: `
The ${repoTag} repo just crossed the ${formattedMilestone} 🌟 milestone on #GitHub 🎉

Way to go and congrats on reaching this epic milestone 💪 ${getHashtags(repo)}
${repo.html_url}
`,
    })
    return
  }
}
