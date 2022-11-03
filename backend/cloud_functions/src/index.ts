import { initializeApp } from 'firebase-admin/app';
import { backupDataFunction } from './application/backup/backup';
import { cleanUpTweetsFunction } from './application/clean_up_tweets/clean_up_tweets';
import { freezeDataFunction } from './application/freeze/freeze';
import {
  postMonthlyFunction,
  updateDataFunction,
} from './application/track/data';

initializeApp();

exports.freezedata = freezeDataFunction;
exports.updatedata = updateDataFunction;
exports.backupdata = backupDataFunction;
exports.postmonthly = postMonthlyFunction;
exports.cleanuptweets = cleanUpTweetsFunction;
