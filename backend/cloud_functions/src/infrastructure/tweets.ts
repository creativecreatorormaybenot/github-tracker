import { TwitterApi } from 'twitter-api-v2';

export class TweetManager {
  protected tweets: Tweet[];
  protected twitter: TwitterApi;

  constructor(twitter: TwitterApi) {
    this.tweets = [];
    this.twitter = twitter;
  }

  /**
   * Adds a tweet to the list of tweets to be posted.
   * @param tweet the tweet to be added.
   */
  addTweet(tweet: Tweet): void {
    this.tweets.push(tweet);
  }

  /**
   * Tweets a single tweet out of the added tweets by priority.
   * This is a noop if there are no tweets to tweet and removes
   * the first tweet and posts it if there is one.
   */
  async tweet(): Promise<void> {
    this.tweets.sort((a, b) => a.priority - b.priority);

    const tweet = this.tweets.shift();
    if (tweet === undefined) return;
    await this.twitter.v2.tweet(tweet.content);
  }
}

export class Tweet {
  /**
   * The content of the tweet.
   *
   * This is the status of the tweet.
   */
  readonly content: string;

  /**
   * The priority of the tweet where lower numbers are higher priority.
   *
   * The tweet with the lowest priority will be tweeted first.
   */
  readonly priority: number;

  constructor(content: string, priority: number) {
    this.content = content;
    this.priority = priority;
  }
}
