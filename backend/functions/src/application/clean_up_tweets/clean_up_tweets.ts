import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
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
 * The function is currently triggered on every 9th day of the month.
 */
export const cleanUpTweetsFunction = onSchedule(
  '0 0 */9 * *',
  async (event) => {
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

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 8);

    const search = await twitter.v2.searchAll(
      `(from:github_tracker) -min_faves:${likesThreshold} until:${tenDaysAgo.getFullYear()}-${tenDaysAgo.getMonth()}-${tenDaysAgo.getDate()}`
    );
    for (const tweet of search) {
      logger.info(
        `Deleting tweet with id="${tweet.id}" because it has less than ${likesThreshold} likes.`
      );
      await twitter.v2.deleteTweet(tweet.id);
    }
  }
);
