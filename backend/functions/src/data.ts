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
import { blurhashFromImage } from './blurhash'

// Initialize clients that can be initialized synchronously.
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
  id: number
  name: string
  full_name: string
  description: string
  language: string | null
  html_url: string
  stargazers_count: number
  open_issues_count: number
  forks_count: number
  owner: {
    id: number
    login: string
    html_url: string
    avatar_url: string
  }
}

interface OwnerMetadata {
  owner: {
    avatar_blurhash: string
  }
}

type RepoMetadata = Pick<
  RepoData,
  | 'timestamp'
  | 'id'
  | 'name'
  | 'full_name'
  | 'description'
  | 'language'
  | 'html_url'
  | 'owner'
  | 'open_issues_count'
  | 'forks_count'
> &
  Partial<RepoData> &
  OwnerMetadata

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
 * @param name the name of the secret in Google Cloud Secret Manager.
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
export const update = functions.pubsub
  .schedule('*/15 * * * *')
  .onRun(async (context) => {
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
      top100External = softwareRepos.slice(0, 100)

    if (top100External.length !== 100) {
      functions.logger.warn(
        `Only ${top100External.length}/100 repos could be retrieved.`
      )
    }
    // We refer to the top100 retrieved from GitHub above as "external" as
    // it uses a different data structure (interface) than the data that we
    // end up saving to our database.
    // Therefore, the "external" format is of type Repo and the "internal" format
    // is of type "RepoData".
    // Any data with a days ago suffix (e.g. 1day, 7day, and 28day) is implicitly
    // considered "internal". This is because the only external data we can get is
    // the *latest* data, i.e. the data as of right now. Any older data has to come
    // from our database and is consequently internal.
    const top100Internal: Array<RepoData> = [],
      // Note that the order of the internal data from previous days is different from the
      // external and internal current data in two ways:
      // 1. It might contain undefined values as past data might not exist.
      // 2. The order of the array elements does *not* represent the order of the repo
      //    positions in that data. Instead, the order corresponds to the position order
      //    (1 to 100) in the current internal or external data.
      top100OneDay: Array<RepoData | undefined> = [],
      top100SevenDay: Array<RepoData | undefined> = [],
      top100TwentyEightDay: Array<RepoData | undefined> = [],
      // We fetch the previous entries to catch repos reaching milestones, surpassing other
      // repos, etc.
      top100Previous: Array<RepoData | undefined> = []

    const batchingPromises: Array<Promise<any>> = []
    for (const repo of top100External) {
      const dataCollection = firestore
        .collection('repos')
        // We use the repo ID because we want to make sure that we
        // can handle repo name changes and owner changes.
        .doc(repo.id.toString())
        .collection('data')
        .withConverter(snapshotConverter<RepoData>())

      const data: RepoData = {
        timestamp: now,
        position: top100External.indexOf(repo) + 1,
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        open_issues_count: repo.open_issues_count,
        forks_count: repo.forks_count,
        owner: {
          id: repo.owner.id,
          login: repo.owner.login,
          html_url: repo.owner.html_url,
          avatar_url: repo.owner.avatar_url,
        },
      }
      batch().create(dataCollection.doc(), data)

      // Save the index for later in order to update the undefined
      // entries in the 1day, 7day, and 28day arrays at the correct index.
      // This is necessary as all of the past internal repo data is fetched
      // in parallel, which means that we cannot trust the order they complete in
      // at all (it is totally random).
      const repoIndex = top100Internal.length
      top100Internal.push(data)
      top100OneDay.push(undefined)
      top100SevenDay.push(undefined)
      top100TwentyEightDay.push(undefined)
      top100Previous.push(undefined)

      if (repoIndex !== data.position - 1) {
        functions.logger.warn(
          `Mismatch between repo index ${repoIndex} and repo position ${data.position} of repo ${data.full_name}.`
        )
      }

      const statsPromise = Promise.all([
        getDaysAgoDoc(dataCollection, now, 1),
        getDaysAgoDoc(dataCollection, now, 7),
        getDaysAgoDoc(dataCollection, now, 28),
        getLatestDoc(dataCollection),
      ]).then(async (snapshots) => {
        const [one, seven, twentyEight, previous] = snapshots.map((snapshot) =>
          snapshot?.data()
        )

        // Create a metadata subset of the repo data that we can include
        // in the stats doc.
        const metadata: RepoMetadata = Object.assign(
          {
            owner: {
              avatar_blurhash: await blurhashFromImage(
                data.owner.avatar_url
              ),
            },
          },
          data
        )
        delete metadata.position
        delete metadata.stargazers_count

        // Store stats data.
        const statsData: StatsData = {
          metadata,
          latest: {
            position: top100External.indexOf(repo) + 1,
            stars: repo.stargazers_count,
          },
          ...(one === undefined
            ? {}
            : {
                oneDay: {
                  position: one.position,
                  stars: one.stargazers_count,
                },
              }),
          ...(seven === undefined
            ? {}
            : {
                sevenDay: {
                  position: seven.position,
                  stars: seven.stargazers_count,
                },
              }),
          ...(twentyEight === undefined
            ? {}
            : {
                twentyEightDay: {
                  position: twentyEight.position,
                  stars: twentyEight.stargazers_count,
                },
              }),
        }
        batch().set(
          typedCollection<StatsData>('stats').doc(`${repo.id}`),
          statsData
        )

        top100OneDay[repoIndex] = one
        top100SevenDay[repoIndex] = seven
        top100TwentyEightDay[repoIndex] = twentyEight
        top100Previous[repoIndex] = previous
      })
      batchingPromises.push(statsPromise)
    }

    // Batch removal of stats docs for repos that are not currently in the top 100.
    batchingPromises.push(batchDeleteUnusedStatsDocs(top100External, batch))
    // Run all the 400 document gets for the historical stats in parallel
    // and not have the function timeout.
    await Promise.all(batchingPromises)

    if (!top100Internal.every((value) => value !== undefined)) {
      functions.logger.warn(
        `Missing internal data (${top100Internal.filter(
          (value) => value === undefined
        )}).`
      )
    }

    // Run all remaining actions in parallel, i.e. committing the batched operations (which
    // might be in multiple batches that are limited to 500 ops) and our track functions.
    await Promise.all([
      // Save the internal data (both stats and repo data entries).
      ...batches.map((b) => b.commit()),
      // Excluding the tracking operations for the moment (see below).
    ] as Promise<any>[])

    // Run tracking in parallel *after* finishing all data operations (so overall run
    // sequentially) until https://github.com/draftbit/twitter-lite/issues/156 is fixed.
    // So *note* that this is a **workaround** for https://github.com/creativecreatorormaybenot/github-tracker/issues/54
    // in order to avoid losing any more data.
    // Ideally, we would run both the data and tracking operations in parallel as much
    // as possible, however, until we find a way to prevent the Twitter client from crashing
    // the whole function, we need to make sure that all data is saved before we run any
    // Twitter operations :)
    const trackingPromises: Array<Promise<any>> = [
      trackFastestGrowing({
        context,
        top100External,
        top100Internal,
        top100SevenDay,
      }),
      // We want to include a reference to the tweetTopRepo function to satifsy the linter.
      // And we do not want to execute it on every function call in order to prevent spam.
      ...(false ? [trackTopRepo(top100External)] : []),
    ]
    // Add tracking operations for all of the top 100 repos individually.
    for (let i = 0; i < top100External.length; i++) {
      const repo = top100External[i],
        current = top100Internal[i],
        // oneDay = top100OneDay[i],
        // sevenDay = top100SevenDay[i],
        // twentyEightDay = top100TwentyEightDay[i],
        previous = top100Previous[i]

      if (previous !== undefined) {
        trackingPromises.push(
          ...[
            trackRepoMilestones(repo, previous),
            trackRepoPosition({
              current,
              previous,
              top100External,
            }),
          ]
        )
      }
    }
    // Run all tracking operations in parallel sequentially after the data operations.
    await Promise.all(trackingPromises)
  })

/**
 * Get a doc that is dated a number of days ago compared to now.
 * @param collection the data collection, where the queried docs have a timestamp field.
 * @param now the timestamp to compare against.
 * @param days the number of days ago the doc should be dated compared to now.
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
 * @param collection the data collection, where the queried docs have a timestamp field.
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
 * Batch the deletion of stats docs for repos that are not currently in the top 100.
 * @param top100External the external data of the top 100 software repos.
 * @param batch function that returns a write batch that still has open ops.
 */
async function batchDeleteUnusedStatsDocs(
  top100External: Repo[],
  batch: () => admin.firestore.WriteBatch
): Promise<void> {
  const statsDocs = await typedCollection<StatsData>('stats').listDocuments()

  const top100Ids = top100External.map((repo) => repo.id.toString())
  for (const repo of statsDocs) {
    if (!top100Ids.includes(repo.id)) {
      batch().delete(repo)
    }
  }
}

/**
 * Generates a repo tag for the given repo based on the full name of the repo.
 * @param repo the repo data.
 * @returns a string repo tag.
 */
function getRepoTag(repo: Repo): string {
  return `*${repo.full_name}*`
}

const enum PadStringMode {
  Start,
  End,
  Both,
  None,
}

/**
 * Pads the input string using the given pad mode.
 * @param input the input string.
 * @param mode the pad string mode.
 * @returns a padded version of the input string.
 */
function padString(input: string, mode: PadStringMode): string {
  switch (mode) {
    case PadStringMode.Start:
      return ` ${input}`
    case PadStringMode.End:
      return `${input} `
    case PadStringMode.Both:
      return ` ${input} `
    case PadStringMode.None:
      return input
  }
}

interface TwitterTagParameters {
  repo: Repo
  padStringMode?: PadStringMode
}

/**
 * Generates a Twitter tag for the owner of the given repo.
 *
 * Note that the repo organization or repo user might not have a connected Twitter account.
 * In that case, an empty string will be returned. Otherwise, the string will be padded
 * according to the PadStringMode.
 * @param repo the repo data.
 * @param padStringMode describes what padding (1 space on the sides) to apply when a tag is found.
 * @returns a string Twitter tag or an empty string.
 */
async function getTwitterTag({
  repo,
  padStringMode = PadStringMode.None,
}: TwitterTagParameters): Promise<string> {
  let twitter_username: string | null | undefined
  if (repo.owner.type === 'User') {
    const user = (
      await octokit.users.getByUsername({ username: repo.owner.login })
    ).data
    twitter_username = user.twitter_username
  } else {
    if (repo.owner.type !== 'Organization') {
      functions.logger.warn(
        `Unknown owner type "${repo.owner.type}" for the owner of the ${repo.full_name} repo.`
      )
    }

    const org = (await octokit.orgs.get({ org: repo.owner.login })).data
    twitter_username = org.twitter_username
  }

  if (twitter_username === null || twitter_username === undefined) {
    return ''
  }
  return padString(`@${twitter_username}`, padStringMode)
}

/**
 * Generates a strings of hashtags based on the given repo.
 * @param repo the repo data.
 * @returns a string array of hashtags.
 */
function getHashtags(repo: Repo): string[] {
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
  return hashtags
}

/**
 * Tracks the top repository.
 * This posts a tweet about the most starred repo.
 * @param top100External the external data for the top 100 repos.
 */
async function trackTopRepo(top100External: Repo[]): Promise<void> {
  // Tweet about top repo.
  const repo = top100External[0]
  const repoTag = getRepoTag(repo)
  const formattedStars = numbro(repo.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  })
  const tweet = `
The currently most starred software repo on #GitHub is ${repoTag} with ${formattedStars} 🌟

${await getTwitterTag({
  repo,
  padStringMode: PadStringMode.End,
})}${getHashtags(repo).join(' ')}
${repo.html_url}`

  functions.logger.info(
    `Tweeting about top repo ${repoTag} at ${repo.stargazers_count} stars (${tweet.length}/280 characters).`
  )
  await twitter.post('statuses/update', {
    status: tweet,
  })
}

/**
 * Checks the given repo for having passed any milestones by comparing the
 * current repo data to the previous stored data.
 * @param repo the current external repo data from GitHub.
 * @param previous the previous internal data we have stored about the repo.
 */
async function trackRepoMilestones(repo: Repo, previous: RepoData) {
  const previousStars = previous.stargazers_count
  const currentStars = repo.stargazers_count

  if (currentStars < previousStars) return

  for (const milestone of milestones) {
    if (currentStars < milestone) break
    if (previousStars >= milestone) continue

    // Tweet about milestone.
    const repoTag = getRepoTag(repo)
    const formattedMilestone = numbro(milestone).format({
      average: true,
      mantissa: 3,
      optionalMantissa: true,
    })
    const tweet = `
The ${repoTag} repo just crossed the ${formattedMilestone} 🌟 milestone on #GitHub 🎉

Way to go${await getTwitterTag({
      repo,
      padStringMode: PadStringMode.Start,
    })} and congrats on reaching this epic milestone 💪 ${getHashtags(
      repo
    ).join(' ')}
${repo.html_url}`

    functions.logger.info(
      `Tweeting about ${repoTag} reaching the ${milestone} milestone (${tweet.length}/280 characters).`
    )
    await twitter.post('statuses/update', {
      status: tweet,
    })
    return
  }
}

/**
 * Tracks the position of the given repo by comparing the current position to its previous position.
 * @param current the current internal data of the repo to track.
 * @param previous the previous internal data of the repo to track.
 * @param top100External the external data for the top 100 repos.
 */
async function trackRepoPosition({
  current,
  previous,
  top100External,
}: {
  current: RepoData
  previous: RepoData
  top100External: Repo[]
}) {
  // There is nothing to inform about when the position has not changed.
  if (current.position === previous.position) return
  // Also, for now I feel like we should only share good news. We could of course also approach this from
  // the opposite perspective, i.e. when the position of one repo improves, it has to disimprove for a
  // different one. That said, the approach in this function is to report about repos rising and also
  // capturing it this way.
  if (current.position > previous.position) return

  const repo = top100External[current.position - 1]
  if (repo.id !== current.id) {
    functions.logger.warn(
      `Position of ${current.full_name} in the top 100 array does not match actual position.`
    )
    return
  }

  // For now, we assume the simplest case, which is one repo taking the position of another, where
  // the position gain is at max 1.
  // The previous leader is now at the position that the repo to track was at before.
  const previousLeader = top100External[previous.position - 1]

  // Tweet about one repo overtaking the other.
  const repoTag = getRepoTag(repo)
  const formattedStars = numbro(current.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  })
  const combinedHashtags = Array.from(
    new Set(getHashtags(repo).concat(getHashtags(previousLeader)))
  ).join(' ')
  const tweet = `
${repoTag} just surpassed ${getRepoTag(previousLeader)} in stars on #GitHub 💥

It is now the #${
    current.position
  } most starred software repo with ${formattedStars} 🌟

${await getTwitterTag({
  repo,
  padStringMode: PadStringMode.End,
})}${combinedHashtags}
${current.html_url}`

  functions.logger.info(
    `Tweeting about ${repoTag} surpassing ${getRepoTag(previousLeader)} (${
      tweet.length
    }/280 characters).`
  )
//   await twitter.post(`statuses/update`, {
//     status: tweet,
//   })
}

/**
 * Tracks the fastest growing repos out of the top 100 software repos.
 *
 * Currently, tweets about it every Monday at 3:15 PM UTC (noop otherwise). We can be sure that the
 * function is not called twice at 3:15 PM as CRON does not allow scheduling more than once per minute.
 *
 * Make sure that the top100 arrays all point to the same repos at the same indexes (indices, duh).
 * This means that the order of elements in the seven day array might not match the actual positions
 * of the repos at that time and should instead match the order at the current time.
 * @param context the function call event context containing the call timestamp.
 * @param top100External the external GitHub data of the top 100 repos.
 * @param top100Current the current internal data of the top 100 repos.
 * @param top100SevenDay the seven day internal data of the top 100 repos (entries might be null).
 */
async function trackFastestGrowing({
  context,
  top100External,
  top100Internal,
  top100SevenDay,
}: {
  context: functions.EventContext
  top100External: Repo[]
  top100Internal: RepoData[]
  top100SevenDay: (RepoData | undefined)[]
}): Promise<void> {
  const time = new Date(Date.parse(context.timestamp))
  if (
    // The day of the week ranges from 0 (Sunday) to 7 (Saturday).
    time.getUTCDay() !== 1 ||
    // The hours value ranges from 0 (12 AM) to 23 (11 PM).
    time.getUTCHours() !== 15 ||
    // The minutes value ranges from 0 to 59.
    time.getUTCMinutes() !== 15
  ) {
    // We only want to run this on Mondays at 3:15 PM.
    return
  }

  if (top100SevenDay.every((value) => value === undefined)) {
    // If every seven day entry is undefined, we do not want to post anything.
    return
  }

  let maxStarsChange = 0
  let previousMaxStarsChange = 0
  let repo: Repo | undefined
  let internal: RepoData | undefined

  for (let i = 0; i < 100; i++) {
    const sevenDay = top100SevenDay[i]
    if (sevenDay === undefined) continue
    const current = top100Internal[i]

    const change = current.stargazers_count - sevenDay.stargazers_count
    if (change <= maxStarsChange) {
      if (change === maxStarsChange) {
        // Edge case where we want to acknowledge that another repo has the same change.
        previousMaxStarsChange = maxStarsChange
      }
      // Note that we will track the *first* repo with the max change only.
      // The thought behind it is that the first repo is the one with more stars overall,
      // which means that it should be the more popular one. The idea is that it makes
      // more sense to post about the more popular. We could think about posting about
      // both in the future :)
      // (this case is unlikely)
      continue
    }

    previousMaxStarsChange = maxStarsChange
    maxStarsChange = change
    repo = top100External[i]
    internal = current
  }

  if (repo === undefined || internal === undefined) {
    // If no repo had a positive change in the past seven days, we do not want to post.
    return
  }
  if (maxStarsChange === 0) {
    // If the maximum change is 0, we definitely do not want to post as well.
    return
  }

  // Tweet about the fastest growing repo of the past week.
  const repoTag = getRepoTag(repo)
  const formattedChange = numbro(maxStarsChange).format({
    thousandSeparated: true,
  })
  const formattedStars = numbro(repo.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  })
  let diffText = ' '
  if (
    maxStarsChange !== previousMaxStarsChange &&
    previousMaxStarsChange !== 0
  ) {
    const formattedDiff = numbro(
      maxStarsChange / previousMaxStarsChange - 1
    ).format({
      output: 'percent',
      mantissa: 1,
      optionalMantissa: true,
    })
    diffText = `(${formattedDiff} more than any other repo) `
  }
  const tweet = `
${repoTag} is the fastest growing top 100 software repo on #GitHub of the past week 🚀

It gained a total of ${formattedChange} 🌟 ${diffText}and is #${
    internal.position
  } most starred overall w/ ${formattedStars} 🌟
  
Way to go${await getTwitterTag({
    repo,
    padStringMode: PadStringMode.Start,
  })} 💪 ${getHashtags(repo).join(' ')}
${repo.html_url}`

  functions.logger.info(
    `Tweeting about ${repoTag} being the fastest growing repo of the past week (${tweet.length}/280 characters).`
  )
  await twitter.post(`statuses/update`, {
    status: tweet,
  })
}
