import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Octokit } from '@octokit/rest';
import {
  Endpoints,
  GetResponseDataTypeFromEndpointMethod,
} from '@octokit/types';
import {
  CollectionReference,
  DocumentData,
  DocumentSnapshot,
  FirestoreDataConverter,
  getFirestore,
  QueryDocumentSnapshot,
  Timestamp,
  WriteBatch,
} from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { merge } from 'lodash';
import numbro from 'numbro';
import { TwitterApi } from 'twitter-api-v2';
import { blurhashFromImage } from '../../infrastructure/blurhash';
import { SecretsAccessor } from '../../infrastructure/secrets';
import { Tweet, TweetManager } from '../../infrastructure/tweets';
import { contentRepos } from './content-repos';
import { milestones } from './milestones';

// Initialize clients that can be initialized synchronously.
const octokit = new Octokit();
const firestore = getFirestore();
const secretManager = new SecretManagerServiceClient();
// The Twitter client is initialized asynchronously in in order to keep the
// async code in there and ensure initialization has completed.
// See initializeTwitter() below.
let twitter: TwitterApi;

type Repo = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.search.repos
>['items'][0];

interface RepoData {
  timestamp: Timestamp;
  position: number;
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
  forks_count: number;
  owner: {
    id: number;
    login: string;
    html_url: string;
    avatar_url: string;
  };
}

interface AdditionalMetadata {
  owner: {
    avatar_blurhash: string;
  };
}

/**
 * RepoMetadata is used for stats and assembled using a subset
 * of RepoData and some AdditionalMetadata.
 */
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
  AdditionalMetadata;

interface StatsSnapshot {
  position: number;
  stars: number;
  positionChange: number;
  starsChange: number;
}

interface StatsData {
  metadata: RepoMetadata;
  latest: StatsSnapshot;
  oneDay?: StatsSnapshot;
  sevenDay?: StatsSnapshot;
  twentyEightDay?: StatsSnapshot;
}

function snapshotConverter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      return data as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return snapshot.data() as T;
    },
  };
}

function typedCollection<T>(path: string): CollectionReference<T> {
  return firestore.collection(path).withConverter(snapshotConverter<T>());
}

/**
 * Updates the tracker (currently every 15 minutes).
 *
 * This involves three steps:
 * 1. Fetch the top 100 repos and save their data.
 * 2. Update the stats for the top 100 repos.
 * 3. Make the Twitter bot take actions based on that if certain events occur.
 */
export const updateDataFunction = onSchedule('*/15 * * * *', async (event) => {
  await initializeTwitter();
  const tweetManager = new TweetManager(twitter);

  // We could also use a Firestore server timestamp instead, however,
  // we want to use the local timestamp here, so that it represents the
  // precise time we made the search request.
  const now = Timestamp.now();

  // We need to make sure that we do not surpass the 500 operations write
  // limit for batch writes. This is why we create a function for dynamically
  // retrieving write batches.
  // At this time, we have at least 100 writes for storing the repo data and 100
  // updates for updating the stats data. However, we cannot know how many deletes
  // we have (as the old data might be faulty). Furthermore, this approach ensures
  // that we can add batch operations later on :)
  const batches: WriteBatch[] = [];
  let opIndex = 0;
  function batch(): WriteBatch {
    if (opIndex % 500 === 0) {
      batches.push(firestore.batch());
    }
    opIndex++;

    return batches[batches.length - 1];
  }

  const top100External = await fetchTop100External();
  if (top100External === undefined) return;

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
    top100Previous: Array<RepoData | undefined> = [];

  const batchingPromises: Array<Promise<any>> = [];
  for (const repo of top100External) {
    const dataCollection = firestore
      .collection('repos')
      // We use the repo ID because we want to make sure that we
      // can handle repo name changes and owner changes.
      .doc(repo.id.toString())
      .collection('data')
      .withConverter(snapshotConverter<RepoData>());

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
        id: repo.owner!.id,
        login: repo.owner!.login,
        html_url: repo.owner!.html_url,
        avatar_url: repo.owner!.avatar_url,
      },
    };
    batch().create(dataCollection.doc(), data);

    // Save the index for later in order to update the undefined
    // entries in the 1day, 7day, and 28day arrays at the correct index.
    // This is necessary as all of the past internal repo data is fetched
    // in parallel, which means that we cannot trust the order they complete in
    // at all (it is totally random).
    const repoIndex = top100Internal.length;
    top100Internal.push(data);
    top100OneDay.push(undefined);
    top100SevenDay.push(undefined);
    top100TwentyEightDay.push(undefined);
    top100Previous.push(undefined);

    if (repoIndex !== data.position - 1) {
      logger.warn(
        `Mismatch between repo index ${repoIndex} and repo position ${data.position} of repo ${data.full_name}.`
      );
    }

    const statsPromise = Promise.all([
      getDaysAgoDoc(dataCollection, now, 1),
      getDaysAgoDoc(dataCollection, now, 7),
      getDaysAgoDoc(dataCollection, now, 28),
      getLatestDoc(dataCollection),
    ]).then(async (snapshots) => {
      const [one, seven, twentyEight, previous] = snapshots.map((snapshot) =>
        snapshot?.data()
      );

      // Create a metadata subset of the repo data that we can include
      // in the stats doc.
      const metadata: RepoMetadata = merge(
        {
          owner: {
            avatar_blurhash: await blurhashFromImage(data.owner.avatar_url),
          },
        },
        data
      );
      delete metadata.position;
      delete metadata.stargazers_count;

      // Store stats data.
      const statsData: StatsData = {
        metadata,
        latest: computeStatsSnapshot({
          snapshotData: data,
          latestData: data,
        }),
        ...(one === undefined
          ? {}
          : {
              oneDay: computeStatsSnapshot({
                snapshotData: one,
                latestData: data,
              }),
            }),
        ...(seven === undefined
          ? {}
          : {
              sevenDay: computeStatsSnapshot({
                snapshotData: seven,
                latestData: data,
              }),
            }),
        ...(twentyEight === undefined
          ? {}
          : {
              twentyEightDay: computeStatsSnapshot({
                snapshotData: twentyEight,
                latestData: data,
              }),
            }),
      };
      batch().set(
        typedCollection<StatsData>('stats').doc(`${repo.id}`),
        statsData
      );

      top100OneDay[repoIndex] = one;
      top100SevenDay[repoIndex] = seven;
      top100TwentyEightDay[repoIndex] = twentyEight;
      top100Previous[repoIndex] = previous;
    });
    batchingPromises.push(statsPromise);
  }

  // Batch removal of stats docs for repos that are not currently in the top 100.
  batchingPromises.push(batchDeleteUnusedStatsDocs(top100External, batch));
  // Run all the 400 document gets for the historical stats in parallel
  // and not have the function timeout.
  await Promise.all(batchingPromises);

  if (!top100Internal.every((value) => value !== undefined)) {
    logger.warn(
      `Missing internal data (${top100Internal.filter(
        (value) => value === undefined
      )}).`
    );
  }

  // Run all remaining actions in parallel, i.e. committing the batched operations (which
  // might be in multiple batches that are limited to 500 ops) and our track functions.
  await Promise.all([
    // Save the internal data (both stats and repo data entries).
    ...batches.map((b) => b.commit()),
    // Excluding the tracking operations for the moment (see below).
  ] as Promise<any>[]);

  const trackingPromises: Array<Promise<any>> = [
    trackTopRepo(top100External, top100Previous, tweetManager),
  ];
  // Add tracking operations for all of the top 100 repos individually.
  for (let i = 0; i < top100External.length; i++) {
    const repo = top100External[i],
      current = top100Internal[i],
      previous = top100Previous[i];

    if (previous !== undefined) {
      trackingPromises.push(
        ...[
          trackRepoMilestones(repo, previous, tweetManager),
          trackRepoPosition({
            current,
            previous,
            top100External,
            tweetManager,
          }),
        ]
      );
    }
  }
  // Run all tracking operations in parallel sequentially after the data operations.
  await Promise.all(trackingPromises);

  // Finally, tweet whatever tweet has the highest priority.
  await tweetManager.tweet();
});

/**
 * Makes the Twitter bot post the fastest growing repo of the month.
 *
 * This function is triggered at 3:15 PM on days 28-31 of each month.
 * The function will only take action if the current day is the last day
 * of the particular month.
 */
export const postMonthlyFunction = onSchedule(
  '15 15 28-31 * *',
  async (event) => {
    // https://bobbyhadz.com/blog/javascript-check-if-date-is-last-day-of-month#check-if-a-date-is-the-last-day-of-the-month-in-javascript
    function isLastDayOfMonth() {
      const date = new Date();
      const oneDayInMs = 1000 * 60 * 60 * 24;
      return new Date(date.getTime() + oneDayInMs).getDate() === 1;
    }
    // Early exit if the function was not triggered on the last day of the month.
    if (!isLastDayOfMonth()) return;

    await initializeTwitter();
    const tweetManager = new TweetManager(twitter);

    // We could also use a Firestore server timestamp instead, however,
    // we want to use the local timestamp here, so that it represents the
    // precise time we made the search request.
    const now = Timestamp.now();

    const top100External = await fetchTop100External();
    if (top100External === undefined) return;

    // We refer to the top100 retrieved from GitHub above as "external" as
    // it uses a different data structure (interface) than the data that we
    // end up saving to our database.
    // Therefore, the "external" format is of type Repo and the "internal" format
    // is of type "RepoData".
    // Any data with a days ago suffix (e.g. 31day) is implicitly
    // considered "internal". This is because the only external data we can get is
    // the *latest* data, i.e. the data as of right now. Any older data has to come
    // from our database and is consequently internal.
    const top100Internal: Array<RepoData> = [],
      top100ThirtyOneDay: Array<RepoData | undefined> = [];

    for (const repo of top100External) {
      const dataCollection = firestore
        .collection('repos')
        // We use the repo ID because we want to make sure that we
        // can handle repo name changes and owner changes.
        .doc(repo.id.toString())
        .collection('data')
        .withConverter(snapshotConverter<RepoData>());

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
          id: repo.owner!.id,
          login: repo.owner!.login,
          html_url: repo.owner!.html_url,
          avatar_url: repo.owner!.avatar_url,
        },
      };

      // Save the index for later in order to update the undefined
      // entries in the 1day, 7day, and 28day arrays at the correct index.
      // This is necessary as all of the past internal repo data is fetched
      // in parallel, which means that we cannot trust the order they complete in
      // at all (it is totally random).
      const repoIndex = top100Internal.length;
      top100Internal.push(data);
      top100ThirtyOneDay.push(undefined);

      if (repoIndex !== data.position - 1) {
        logger.warn(
          `Mismatch between repo index ${repoIndex} and repo position ${data.position} of repo ${data.full_name}.`
        );
      }

      const thirtyOne = (await getDaysAgoDoc(dataCollection, now, 31))?.data();
      top100ThirtyOneDay[repoIndex] = thirtyOne;
    }

    if (!top100Internal.every((value) => value !== undefined)) {
      logger.warn(
        `Missing internal data (${top100Internal.filter(
          (value) => value === undefined
        )}).`
      );
    }

    await trackFastestGrowing({
      period: 'of the month',
      top100External,
      top100Internal,
      top100Comparison: top100ThirtyOneDay,
      tweetManager,
    });

    // Finally, tweet whatever tweet has the highest priority.
    await tweetManager.tweet();
  }
);

/**
 * Fetches the top 100 software repos from the GitHub API.
 */
async function fetchTop100External(): Promise<Repo[] | undefined> {
  // 32986 is the precise amount of stars that exactly only 200 repos
  // had achieved at the time I wrote this code. There were 201 repos
  // that had achieved 32986 stars.
  // We fetch the top 200 repos to get the top 100 software repos because
  // we assume that less than half of the repos are content repos.
  const q = 'stars:>32986',
    sort = 'stars',
    per_page = 100;
  const params: Endpoints['GET /search/repositories']['parameters'] = {
    q,
    sort,
    per_page,
  };
  // We assume that the requests are successful and do not care about any
  // other information that comes with the response.
  let repos: Array<Repo> = [];
  params.page = 1;
  repos = repos.concat((await octokit.search.repos(params)).data.items);
  params.page = 2;
  repos = repos.concat((await octokit.search.repos(params)).data.items);

  const softwareRepos = repos.filter(
      (repo) => !contentRepos.includes(repo.full_name)
    ),
    top100External = softwareRepos.slice(0, 100);

  // Make sure to exit early if the integrity of the retrieved data cannot be confirmed.
  if (!checkTop100Integrity(top100External)) return undefined;
  return top100External;
}

function checkTop100Integrity(repos: Repo[]): boolean {
  if (repos.length !== 100) {
    logger.error(
      `Loaded data integrity compromised as only ` +
        `${repos.length}/100 top 100 repos were loaded.`
    );
    return false;
  }
  let stars = repos[0].stargazers_count;
  for (let i = 1; i < 100; i++) {
    if (repos[i].stargazers_count <= stars) {
      stars = repos[i].stargazers_count;
      continue;
    }
    logger.error(
      `Integrity of loaded top 100 data is compromised as ` +
        `${repos[i].full_name} (position=${i + 1}) has ${
          repos[i].stargazers_count
        } ` +
        `while the previous repo ${
          repos[i - 1].full_name
        } (position=${i}) has ${stars}, ` +
        `i.e. the order is wrong.`
    );
    return false;
  }
  return true;
}

function computeStatsSnapshot({
  snapshotData,
  latestData,
}: {
  snapshotData: RepoData;
  latestData: RepoData;
}): StatsSnapshot {
  return {
    position: snapshotData.position,
    stars: snapshotData.stargazers_count,
    positionChange: snapshotData.position - latestData.position,
    starsChange: latestData.stargazers_count - snapshotData.stargazers_count,
  };
}

/**
 * Get a doc that is dated a number of days ago compared to now.
 * @param collection the data collection, where the queried docs have a timestamp field.
 * @param now the timestamp to compare against.
 * @param days the number of days ago the doc should be dated compared to now.
 * @returns undefined if there is no such recorded data or one matching snapshot.
 */
async function getDaysAgoDoc<T>(
  collection: CollectionReference<T>,
  now: Timestamp,
  days: number
): Promise<DocumentSnapshot<T> | undefined> {
  const daysAgoMillis = now.toMillis() - 1000 * 60 * 60 * 24 * days;
  const result = await collection
    .where(
      'timestamp',
      '>=',
      // Give five minutes of slack for potential function execution deviations.
      Timestamp.fromMillis(daysAgoMillis - 1000 * 300)
    )
    .where(
      'timestamp',
      '<',
      // Give one hour of slack in case there was an issue with storing the data.
      // If the data is more than an hour old, we declare it as unusable.
      Timestamp.fromMillis(daysAgoMillis + 1000 * 60 * 60)
    )
    .limit(1)
    .withConverter(snapshotConverter<T>())
    .get();
  return result.docs.length === 0 ? undefined : result.docs[0];
}

/**
 * Get the latest doc in the given collection.
 * @param collection the data collection, where the queried docs have a timestamp field.
 * @returns undefined if there is no such recorded data or one matching snapshot.
 */
async function getLatestDoc<T>(
  collection: CollectionReference<T>
): Promise<DocumentSnapshot<T> | undefined> {
  const result = await collection
    .orderBy('timestamp', 'desc')
    .limit(1)
    .withConverter(snapshotConverter<T>())
    .get();
  return result.docs.length === 0 ? undefined : result.docs[0];
}

/**
 * Batch the deletion of stats docs for repos that are not currently in the top 100.
 * @param top100External the external data of the top 100 software repos.
 * @param batch function that returns a write batch that still has open ops.
 */
async function batchDeleteUnusedStatsDocs(
  top100External: Repo[],
  batch: () => WriteBatch
): Promise<void> {
  const statsDocs = await typedCollection<StatsData>('stats').listDocuments();

  const top100Ids = top100External.map((repo) => repo.id.toString());
  for (const repo of statsDocs) {
    if (!top100Ids.includes(repo.id)) {
      batch().delete(repo);
    }
  }
}

/**
 * Generates a repo tag for the given repo based on the full name of the repo.
 * @param repo the repo data.
 * @returns a string repo tag.
 */
function getRepoTag(repo: Repo): string {
  return `*${repo.full_name}*`;
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
      return ` ${input}`;
    case PadStringMode.End:
      return `${input} `;
    case PadStringMode.Both:
      return ` ${input} `;
    case PadStringMode.None:
      return input;
  }
}

interface TwitterTagParameters {
  repo: Repo;
  padStringMode?: PadStringMode;
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
  let twitter_username: string | null | undefined;
  if (repo.owner!.type === 'User') {
    const user = (
      await octokit.users.getByUsername({ username: repo.owner!.login })
    ).data;
    twitter_username = user.twitter_username;
  } else {
    if (repo.owner!.type !== 'Organization') {
      logger.warn(
        `Unknown owner type "${repo.owner!.type}" for the owner of the ${
          repo.full_name
        } repo.`
      );
    }

    const org = (await octokit.orgs.get({ org: repo.owner!.login })).data;
    twitter_username = org.twitter_username;
  }

  if (twitter_username === null || twitter_username === undefined) {
    return '';
  }
  return padString(`@${twitter_username}`, padStringMode);
}

/**
 * Generates a strings of hashtags based on the given repo.
 * @param repo the repo data.
 * @returns a string array of hashtags.
 */
function getHashtags(repo: Repo): string[] {
  const hashtags = [formatHashtag(repo.owner!.login)];
  if (repo.owner!.login !== repo.name) {
    hashtags.push(formatHashtag(repo.name));
  }
  if (
    repo.language !== null &&
    repo.language !== repo.owner!.login &&
    repo.language !== repo.name
  ) {
    hashtags.push(formatHashtag(repo.language));
  }
  return hashtags;
}

/**
 * Formats a given tag to work as a hashtag on Twitter.
 * This excludes or transforms certain illegal characters
 * and prefixes the hash.
 * @param tag the desired tag to be placed after the hash.
 */
function formatHashtag(tag: string): string {
  const formatted = tag
    .replace(/[-_.]/g, '')
    .replace(/#/g, 'sharp')
    .replace(/\+/g, 'plus');
  return `#${formatted}`;
}

/**
 * Tracks the top repository.
 * This posts a tweet about the most starred repo when it changes.
 * @param top100External The external data for the top 100 repos.
 * @param top100Previous The last saved internal data for the top 100 repos.
 * @param tweetManager The tweet manager for adding tweets.
 */
async function trackTopRepo(
  top100External: Repo[],
  top100Previous: (RepoData | undefined)[],
  tweetManager: TweetManager
): Promise<void> {
  // Tweet about top repo.
  const repo = top100External[0];
  const previous = top100Previous[0];
  if (previous === undefined) return;
  // Only post about the top repo in case it changed.
  if (repo.id === previous.id) return;

  const repoTag = getRepoTag(repo);
  const formattedStars = numbro(repo.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  });
  const tweet = `
${repoTag} is now the most starred software repo on #GitHub at ${formattedStars} 🌟

${await getTwitterTag({
  repo,
  padStringMode: PadStringMode.End,
})}${getHashtags(repo).join(' ')}
${repo.html_url}`;

  logger.info(
    `Tweeting about top repo ${repoTag} at ${repo.stargazers_count} stars (${tweet.length}/280 characters).`
  );
  tweetManager.addTweet(new Tweet(tweet, 0));
}

/**
 * Checks the given repo for having passed any milestones by comparing the
 * current repo data to the previous stored data.
 * @param repo the current external repo data from GitHub.
 * @param previous the previous internal data we have stored about the repo.
 * @param tweetManager the tweet manager for adding tweets.
 */
async function trackRepoMilestones(
  repo: Repo,
  previous: RepoData,
  tweetManager: TweetManager
): Promise<void> {
  const previousStars = previous.stargazers_count;
  const currentStars = repo.stargazers_count;

  if (currentStars < previousStars) return;

  for (const milestone of milestones) {
    if (currentStars < milestone) break;
    if (previousStars >= milestone) continue;

    // Tweet about milestone.
    const repoTag = getRepoTag(repo);
    const formattedMilestone = numbro(milestone).format({
      average: true,
      mantissa: 3,
      optionalMantissa: true,
    });
    const tweet = `
${repoTag} just reached ${formattedMilestone} 🌟 on #GitHub 🎉

Way to go${await getTwitterTag({
      repo,
      padStringMode: PadStringMode.Start,
    })} and congrats on reaching this epic milestone 💪 ${getHashtags(
      repo
    ).join(' ')}
${repo.html_url}`;

    logger.info(
      `Tweeting about ${repoTag} reaching the ${milestone} milestone (${tweet.length}/280 characters).`
    );
    tweetManager.addTweet(new Tweet(tweet, 1));
    return;
  }
}

/**
 * Tracks the position of the given repo by comparing the current position to its previous position.
 * If the repo is currently not in the top 25 repos, the function will not take action.
 * @param current the current internal data of the repo to track.
 * @param previous the previous internal data of the repo to track.
 * @param top100External the external data for the top 100 repos.
 * @param tweetManager the tweet manager for adding tweets.
 */
async function trackRepoPosition({
  current,
  previous,
  top100External,
  tweetManager,
}: {
  current: RepoData;
  previous: RepoData;
  top100External: Repo[];
  tweetManager: TweetManager;
}): Promise<void> {
  // Posting about position changes outside of the top 25 is too verbose.
  if (current.position > 25) return;
  // There is nothing to inform about when the position has not changed.
  if (current.position === previous.position) return;
  // Also, for now I feel like we should only share good news. We could of course also approach this from
  // the opposite perspective, i.e. when the position of one repo improves, it has to disimprove for a
  // different one. That said, the approach in this function is to report about repos rising and also
  // capturing it this way.
  if (current.position > previous.position) return;

  const repo = top100External[current.position - 1];
  if (repo.id !== current.id) {
    logger.warn(
      `Position of ${current.full_name} in the top 100 array does not match actual position.`
    );
    return;
  }

  // For now, we assume the simplest case, which is one repo taking the position of another, where
  // the position gain is at max 1.
  // The previous leader is now at the position that the repo to track was at before.
  const previousLeader = top100External[previous.position - 1];

  // Tweet about one repo overtaking the other.
  const repoTag = getRepoTag(repo);
  const formattedStars = numbro(current.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  });
  const combinedHashtags = Array.from(
    new Set(getHashtags(repo).concat(getHashtags(previousLeader)))
  ).join(' ');
  const tweet = `
${repoTag} just surpassed ${getRepoTag(previousLeader)} in stars on #GitHub 💥

The repo is now at ${formattedStars} 🌟 (top #${current.position} software repo)

${await getTwitterTag({
  repo,
  padStringMode: PadStringMode.End,
})}${combinedHashtags}
${current.html_url}`;

  logger.info(
    `Tweeting about ${repoTag} surpassing ${getRepoTag(previousLeader)} (${
      tweet.length
    }/280 characters).`
  );
  tweetManager.addTweet(new Tweet(tweet, 3));
}

/**
 * Tracks the fastest growing repo out of the top 100 software repos.
 *
 * The top100 arrays must all point to the same repos at the same indexes (indices, duh).
 * This means that the order of elements in the seven day array might not match the actual positions
 * of the repos at that time and should instead match the order at the current time.
 * @param period The time period of the comparison as a readable string.
 * This should make sense in "This is the fastest growing repo ${period}", e.g. "of the month".
 * @param top100External The external GitHub data of the top 100 repos.
 * @param top100Internal The current internal data of the top 100 repos.
 * @param top100Comparison The internal comparison data that is from the given time period ago (entries might be null).
 * @param tweetManager The @type {TweetManager} for adding tweets.
 */
async function trackFastestGrowing({
  period,
  top100External,
  top100Internal,
  top100Comparison,
  tweetManager,
}: {
  period: string;
  top100External: Repo[];
  top100Internal: RepoData[];
  top100Comparison: (RepoData | undefined)[];
  tweetManager: TweetManager;
}): Promise<void> {
  if (top100Comparison.every((value) => value === undefined)) {
    // If every thirty one day entry is undefined, we do not want to post anything.
    return;
  }

  let maxStarsChange = 0;
  let previousMaxStarsChange = 0;
  let repo: Repo | undefined;
  let internal: RepoData | undefined;

  for (let i = 0; i < 100; i++) {
    const sevenDay = top100Comparison[i];
    if (sevenDay === undefined) continue;
    const current = top100Internal[i];

    const change = current.stargazers_count - sevenDay.stargazers_count;
    if (change <= maxStarsChange) {
      if (change === maxStarsChange) {
        // Edge case where we want to acknowledge that another repo has the same change.
        previousMaxStarsChange = maxStarsChange;
      }
      // Note that we will track the *first* repo with the max change only.
      // The thought behind it is that the first repo is the one with more stars overall,
      // which means that it should be the more popular one. The idea is that it makes
      // more sense to post about the more popular. We could think about posting about
      // both in the future :)
      // (The case of two repos gaining the exact same amount of stars is unlikely,
      // especially with longer time periods.)
      continue;
    }

    previousMaxStarsChange = maxStarsChange;
    maxStarsChange = change;
    repo = top100External[i];
    internal = current;
  }

  if (repo === undefined || internal === undefined) {
    // If no repo had a positive change in the past seven days, we do not want to post.
    return;
  }
  if (maxStarsChange === 0) {
    // If the maximum change is 0, we definitely do not want to post as well.
    return;
  }

  // Tweet about the fastest growing repo of the given time period.
  const repoTag = getRepoTag(repo);
  const formattedChange = numbro(maxStarsChange).format({
    thousandSeparated: true,
  });
  const formattedStars = numbro(repo.stargazers_count).format({
    average: true,
    mantissa: 1,
    optionalMantissa: true,
  });
  let diffText = ' ';
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
    });
    diffText = `(${formattedDiff} more than any other repo) `;
  }
  const tweet = `
${repoTag} is the fastest growing top 100 software repo on #GitHub ${period} 🚀

+${formattedChange} 🌟 during that time ${diffText}
-> ${formattedStars} 🌟 in total (top #${internal.position} software repo)
  
Way to go${await getTwitterTag({
    repo,
    padStringMode: PadStringMode.Start,
  })} 💪 ${getHashtags(repo).join(' ')}
${repo.html_url}`;

  logger.info(
    `Tweeting about ${repoTag} being the fastest growing repo ${period} (${tweet.length}/280 characters).`
  );
  tweetManager.addTweet(new Tweet(tweet, 2));
}

/**
 * Asynchronously initializes the global @type {TwitterApi} instance
 * using the credentials stored in Google Cloud Secret Manager.
 */
async function initializeTwitter(): Promise<void> {
  // Load the Twitter client asynchronously on cold start.
  // The reason we have to do this is in order to ensure that
  // the client is loaded before execution as it depends on secrets
  // that can only be loaded asynchronously from secret manager.
  if (twitter === undefined) {
    const secretsAccessor = new SecretsAccessor(secretManager);
    twitter = new TwitterApi({
      appKey: await secretsAccessor.access('TWITTER_APP_CONSUMER_KEY'),
      appSecret: await secretsAccessor.access(
        'TWITTER_APP_CONSUMER_KEY_SECRET'
      ),
      accessToken: await secretsAccessor.access('TWITTER_APP_ACCESS_TOKEN'),
      accessSecret: await secretsAccessor.access(
        'TWITTER_APP_ACCESS_TOKEN_SECRET'
      ),
    });
  }
}
