import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Octokit } from '@octokit/rest'

admin.initializeApp()
const octokit = new Octokit()
const firestore = admin.firestore()

/**
 * Runs every minute.
 */
exports.update = functions.pubsub
  .schedule('* * * * *')
  .onRun(async (context) => {
    // The start date is only use for logging purposes.
    const start = new Date()

    // We could also use a Firestore server timestamp instead, however,
    // we want to use the local timestamp here, so that it represents the
    // precise time we made the search request.
    const now = FirebaseFirestore.Timestamp.now()

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
      batch.create(
        firestore
          .collection('repos')
          // We use the repo ID because we want to make sure that we
          // can handle repo name changes and owner changes.
          .doc(repo.id.toString())
          .collection('data')
          .doc(),
        {
          timestamp: now,
          position: softwareRepos.indexOf(repo) + 1,
          // We can store the whole item we retrieved from Octokit
          // as the GitHub data.
          github: repo,
        }
      )
      batch.set(firestore.doc(`stats/${repo.id}`), repo)
    }

    await batch.commit()

    functions.logger.info(
      `Started update at ${start} and ended at ${new Date()}.`
    )
  })

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
