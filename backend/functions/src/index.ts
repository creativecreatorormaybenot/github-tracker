import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Octokit } from '@octokit/rest'

admin.initializeApp()
const octokit = new Octokit()
const firestore = admin.firestore()

/**
 * Updates the tracker (currently every 15 minutes).
 *
 * This involves three steps:
 * 1. Fetch the top 100 repos and save their data.
 * 2. Update the stats for the top 100 repos.
 * 3. Make the Twitter bot take actions based on that if certain events occur.
 */
exports.update = functions.pubsub
  // We update every 15 minutes in order to stay within the free tier of Cloud Firestore.
  // We have 20k free writes per day. Every update call will trigger exactly 200 writes
  // and up to 100 deletes. The delete limit is also 20k, so we do not need to consider
  // deletes (as we will never perform more deletes than writes but have twice the limit).
  // In order to not surpass the free limit of 20k reads, we can therefore update
  // 20000 / 200 = 100 times per day. There are 1440 minutes in a day, which means that we
  // can update every 14.4 minutes. Consequently, every 15 minutes is the maximum frequency
  // we can use for updating.
  .schedule('*/15 * * * *')
  .onRun(async (context) => {
    // The start date is only use for logging purposes.
    const start = new Date()

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
    // We assume that the requests are successful and do not care about any
    // other information that comes with the response.
    const items = (
      await octokit.search.repos({ q, sort, per_page, page: 1 })
    ).data.items.concat(
      (await octokit.search.repos({ q, sort, per_page, page: 2 })).data.items
    )

    const softwareRepos = items.filter(
        (item) => !contentRepos.includes(item.full_name)
      ),
      top100 = softwareRepos.slice(0, 100)

    if (top100.length != 100) {
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
        // We can store the whole item we retrieved from Octokit
        // as the GitHub data.
        github: repo,
      })

      const oneDayDoc = await getDaysAgoDoc(dataCollection, now, 1),
        sevenDayDoc = await getDaysAgoDoc(dataCollection, now, 7),
        twentyEightDayDoc = await getDaysAgoDoc(dataCollection, now, 28)

      batch.set(firestore.doc(`stats/${repo.id}`), {
        current: {
          position: softwareRepos.indexOf(repo) + 1,
          stars: repo.stargazers_count,
        },
        ...(oneDayDoc == undefined
          ? {}
          : {
              '1day': {
                position: oneDayDoc.get('position'),
                stars: oneDayDoc.get('stars'),
              },
            }),
        ...(sevenDayDoc == undefined
          ? {}
          : {
              '7day': {
                position: sevenDayDoc.get('position'),
                stars: sevenDayDoc.get('stars'),
              },
            }),
        ...(twentyEightDayDoc == undefined
          ? {}
          : {
              '28day': {
                position: twentyEightDayDoc.get('position'),
                stars: twentyEightDayDoc.get('stars'),
              },
            }),
      })
    }

    await batch.commit()

    functions.logger.info(
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
  return result.docs.length == 0 ? undefined : result.docs[0]
}

/**
 * This list of content repos is a direct copy of https://github.com/timsneath/github-tracker/blob/f490b633b211ef6b400371d6953de7171993aedf/lib/contentRepos.dart#L10.
 *
 * I also contributed to that list as part of making this project.
 *
 * The github-tracker repo (home of the list) created by timsneath is also a major inspiration for this project.
 */
const contentRepos: Array<string> = [
  '996icu/996.ICU',
  'freeCodeCamp/freeCodeCamp',
  'EbookFoundation/free-programming-books',
  'sindresorhus/awesome',
  'getify/You-Dont-Know-JS',
  'airbnb/javascript',
  'github/gitignore',
  'jwasham/coding-interview-university',
  'kamranahmedse/developer-roadmap',
  'h5bp/html5-boilerplate',
  'toddmotto/public-apis',
  'resume/resume.github.com',
  'nvbn/thefuck',
  'h5bp/Front-end-Developer-Interview-Questions',
  'jlevy/the-art-of-command-line',
  'google/material-design-icons',
  'mtdvio/every-programmer-should-know',
  'justjavac/free-programming-books-zh_CN',
  'vuejs/awesome-vue',
  'josephmisiti/awesome-machine-learning',
  'ossu/computer-science',
  'NARKOZ/hacker-scripts',
  'papers-we-love/papers-we-love',
  'danistefanovic/build-your-own-x',
  'thedaviddias/Front-End-Checklist',
  'Trinea/android-open-project',
  'donnemartin/system-design-primer',
  'Snailclimb/JavaGuide',
  'xingshaocheng/architect-awesome',
  'FreeCodeCampChina/freecodecamp.cn',
  'vinta/awesome-python',
  'avelino/awesome-go',
  'wasabeef/awesome-android-ui',
  'vsouza/awesome-ios',
  'enaqx/awesome-react',
  'awesomedata/awesome-public-datasets',
  'tiimgreen/github-cheat-sheet',
  'CyC2018/Interview-Notebook',
  'CyC2018/CS-Notes',
  'kdn251/interviews',
  'minimaxir/big-list-of-naughty-strings',
  'k88hudson/git-flight-rules',
  'Kickball/awesome-selfhosted',
  'jackfrued/Python-100-Days',
  'public-apis/public-apis',
  'scutan90/DeepLearning-500-questions',
  'MisterBooo/LeetCodeAnimation',
  'awesome-selfhosted/awesome-selfhosted',
  'yangshun/tech-interview-handbook',
  'goldbergyoni/nodebestpractices',
  'jaywcjlove/awesome-mac',
  'labuladong/fucking-algorithm',
  'aymericdamien/TensorFlow-Examples',
  'Hack-with-Github/Awesome-Hacking',
  '30-seconds/30-seconds-of-code',
]
