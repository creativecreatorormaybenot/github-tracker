import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { v2beta3 } from '@google-cloud/tasks';
import * as v1 from 'firebase-functions/v1';
import { ApiResponseError, TweetV2, TwitterApi } from 'twitter-api-v2';
import { SecretsAccessor } from '../../infrastructure/secrets';

const secretManager = new SecretManagerServiceClient();
// The Twitter client is initialized asynchronously in the update function
// in order to keep the async code in there and ensure initialization has
// completed.
// Tweets below this threshold are deemed irrelevant.
let twitter: TwitterApi;

const loggingTag = '[clean-up-tweets]';

/**
 * Deletes all tweets matching or below the specified likes threshold that
 * is older than 8 days.
 *
 * The function is currently triggered on the first day of every month.
 */
export const cleanUpTweetsScheduledFunction = v1
  .region('us-central1')
  .pubsub.schedule('0 0 1 * *')
  .onRun(async (context) => cleanUpTweets());

/**
 * HTTPs trigger for cleaning up tweets that allows execution via Cloud Tasks.
 */
export const cleanUpTweetsHttpFunction = v1.https.onRequest(
  async (request, response) => {
    try {
      cleanUpTweets();
    } catch (e) {
      response.status(500);
      response.send({
        error: e,
      });
      return;
    }

    response.status(200);
  }
);

async function cleanUpTweets(): Promise<void> {
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

  // Any tweet with matching or less likes than this threshold will be deleted.
  const likesThreshold = 14;
  // Any tweet after the date threshold will be deleted.
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - 8);

  const paginator = await twitter.v2.userTimeline('1363301907033444353', {
    max_results: 100,
    end_time: dateThreshold.toISOString(),
    'tweet.fields': ['public_metrics'],
  });
  let count = 0;
  const tweetsToDelete: Array<TweetV2> = [];
  try {
    for await (const [tweet, _] of paginator.fetchAndIterate()) {
      count++;
      if (tweet.public_metrics!.like_count > likesThreshold) continue;
      if (new Date(tweet.created_at!) > dateThreshold) continue;
      tweetsToDelete.push(tweet);
    }
  } catch (e) {
    if (e instanceof ApiResponseError) {
      await catchApiResponseError(e);
      return;
    }
  } finally {
    console.info(
      loggingTag,
      `Fetched ${count} tweets.`,
      `${tweetsToDelete.length} of those should be cleaned up.`
    );
  }

  tweetsToDelete.sort(function (a, b) {
    // Sort the latest tweets first.
    return new Date(a.created_at!) < new Date(b.created_at!) ? -1 : 1;
  });
  let deleted = 0;
  try {
    for (const tweet of tweetsToDelete) {
      console.info(
        loggingTag,
        `Deleting tweet with id="${tweet.id}" as it does not have more than ${likesThreshold} likes.`
      );
      await twitter.v2.deleteTweet(tweet.id);
      deleted++;
    }
  } catch (e) {
    if (e instanceof ApiResponseError) {
      await catchApiResponseError(e);
      return;
    }
  } finally {
    console.info(
      loggingTag,
      `Deleted ${deleted}/${tweetsToDelete.length} tweets.`
    );
  }
}

/**
 * Catches an @type {ApiResponseError} from the Twitter v2 API.
 *
 * In case the error occurred due to a rate limit error, schedules
 * the cleanUpTweetsFunction to run again once the rate limit has reset.
 */
async function catchApiResponseError(e: ApiResponseError): Promise<void> {
  if (!e.rateLimitError) {
    console.error(
      loggingTag,
      `Cleaning up tweets was cancelled due to ${e.message}`
    );
    return;
  }
  const rateLimit = e.rateLimit!;
  if (rateLimit.remaining !== 0 || rateLimit.limit === 0) return;

  const retryDate = new Date(rateLimit.reset * 1000);
  console.warn(
    loggingTag,
    'Twitter API rate limit has been reached ',
    `(0/${rateLimit.limit} requests remaining). `,
    `Retrying request at ${retryDate.toISOString()}.`
  );

  // Schedule a Cloud Task at the reset time of the Twitter API rate limit
  // to invoke the cleanUpTweetsHttpFunction and continue cleaning up.
  const url =
    'https://us-central1-github-tracker-b5c54.cloudfunctions.net/cleanuptweetshttps';

  const client = new v2beta3.CloudTasksClient();
  const parent = client.queuePath(
    'github-tracker-b5c54',
    'us-central1',
    'clean-up-tweets-queue'
  );
  const [response] = await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url,
        oidcToken: {
          serviceAccountEmail:
            'clean-up-tweets-invoker@github-tracker-b5c54.iam.gserviceaccount.com',
          audience: url,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
      scheduleTime: {
        seconds: retryDate.getTime() / 1000,
      },
    },
  });
  console.info(
    loggingTag,
    'Created task',
    response.name,
    'to retry cleaning up tweets at',
    retryDate.toISOString()
  );
}
