import { initializeApp } from 'firebase-admin/app';
import { backupDataFunction } from './application/backup/backup';
import { cleanUpTweetsFunction } from './application/clean_up_tweets/clean_up_tweets';
import { freezeDataFunction } from './application/freeze/freeze';
import {
  postMonthlyFunction,
  updateDataFunction,
} from './application/track/data';

initializeApp();

exports['freeze-data'] = freezeDataFunction;
exports['update-data'] = updateDataFunction;
exports['backup-data'] = backupDataFunction;
exports['post-monthly'] = postMonthlyFunction;
exports['clean-up-tweets'] = cleanUpTweetsFunction;
