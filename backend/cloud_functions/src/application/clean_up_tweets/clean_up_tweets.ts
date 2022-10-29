import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { schedule } from 'firebase-functions/v1/pubsub';
import { TwitterApi } from 'twitter-api-v2';
import { SecretsAccessor } from '../../infrastructure/secrets';

const secretManager = new SecretManagerServiceClient();
// The Twitter client is initialized asynchronously in the update function
// in order to keep the async code in there and ensure initialization has
// completed.
// Tweets below this threshold are deemed irrelevant.
let twitter: TwitterApi;

// Any tweet with matching or less likes than this threshold will be deleted.
const likesThreshold = 3;

/**
 * Deletes all tweets matching or below the specified likes threshold that
 * is older than 8 days.
 *
 * The function is currently triggered on the first day of every month.
 */
export const cleanUpTweetsFunction = schedule('0 0 1 * *').onRun(
  async (context) => {
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

    const date = new Date();
    date.setDate(date.getDate() - 8);

    const paginator = await twitter.v2.userTimeline('1363301907033444353', {
      max_results: 100,
      end_time: date.toISOString(),
      'tweet.fields': ['public_metrics'],
    });
    let count = 0;
    try {
      for await (const [tweet, _] of paginator.fetchAndIterate()) {
        count++;
        if (tweet.public_metrics!.like_count > likesThreshold) continue;
        console.info(
          `Deleting tweet with id="${tweet.id}" as it does not have more than ${likesThreshold} likes.`
        );
        await twitter.v2.deleteTweet(tweet.id);
      }
    } catch (e) {
      console.error(e);
    }
    console.info(`Iterated over ${count} tweets.`);
  }
);