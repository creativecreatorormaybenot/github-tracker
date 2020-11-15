import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { Octokit } from '@octokit/rest'

admin.initializeApp()
const octokit = new Octokit()

/**
 * Runs every minute.
 */
exports.update = functions.pubsub
  .schedule('* * * * *')
  .onRun(async (context) => {
    functions.logger.info(
      `It is ${new Date()} in the Cloud Functions environment.`
    )

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

    functions.logger.info(
      `Retrieved the data of the ${items.length} most popular repos.`
    )

    const softwareRepos = items.filter(
      (item) => !contentRepos.includes(item.full_name)
    )

    functions.logger.info(
      `Only ${softwareRepos.length} repos of them are software repos.`
    )
  })

/**
 * This list of content repos is a direct copy of https://github.com/timsneath/github-tracker/blob/f490b633b211ef6b400371d6953de7171993aedf/lib/contentRepos.dart#L10.
 *
 * The github-tracker repo created by timsneath is also a major inspiration for this project.
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
]
