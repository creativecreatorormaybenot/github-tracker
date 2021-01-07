# github-tracker

## Cost limitations

As this is a project I am doing for fun with no revenue, there is no budget for it.  
And as running backend services and hosting applications usually has costs associated with it,
there are limits imposed on this project.

Specifically, I went with a Firebase backend for the project (there is no tracking, i.e. I am not using
any analytics services - only database, hosting, etc.). The free limits can be found on the [Firebase pricing] page.  
The project does run on a Blaze Plan, so there might be costs for me, however, it is only reasonable for
me to stay within the free limits that you can find on the left side of the table on that site. If I exceed those, I would
probably have to shut down the project.

### Breakdown

Here is a table of relevant limits that directly limit the GitHub tracker application.

| Free limit                              | Consequence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Goal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Cost for goal |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 20k document writes per day (Firestore) | The tracker can only update every 15 minutes because we write 200 documents every update. 20000 / 200 = 100 updates per day 24 \* 60 = 1440 minutes in a day 14400 / 100 = 14.4 minutes between every update → can only update every 15 minutes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | I would love to have the tracker update every minute. Cron jobs allow updates every minute, so this would make most sense from a technical limitation standup (as I am currently using a cron job). This would mean 288k writes a day (200 \* 60 \* 24) and 8.64m per month.                                                                                                                                                                                                                                                               | ~16\$/month   |
| 360 MB transferred per day (Hosting)    | The limit means that Firebse Hosting will only deliver 360 MB and one new user will already retrieve a few MB when nothing is cached (large page site because of Flutter :D). → limited to about 100 page visits per day. (note that GitHub Pages would remove this limit as a workaround)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | n/a           |
| 50k document reads per day (Firestore)  | As every page visit will perform at least as many reads as repos are displayed, I am currently purposefully only showing the top 10 repos initially. If you stay around for a little bit, the data will be updated and the same number of reads are performed again. Given the limit from above, this only happens every 15 minutes - so realistically every page visit will cost 20 reads at this time. Additionally, the tracker performs at least 300 reads per update (300 for the 1 day, 7 day, and 28 day information). Additional reads might occur when information for the Twitter bot is retrieved. I would say that there are about 20k document reads left for users at the current update rate → limited to 1000 page visits per day. | Because my goal is having updates every minutes, we have at least 12.96m reads per month (see section above for similar calculation) from the tracker updating the data. There might be additional ones for querying data for tweets. Additionally, you should still be able to access the web app :D If the data is updated every minute, there will also be more than 2 reads per repo per page visit and I would like to be able to show all 100 repos in the web app. I would say 15m reads per month is a realistic overall estimate. | ~9\$/month    |
| 1 GiB total stored data (Firestore)     | As the app requires storing records of the top 100 records in order to track them and compare their current stats to the stats from a day/week/month ago. The 1 GiB limit means that the app either stops working because no new records can be added or I need to delete old data. We are currently at 0/1 GiB used. → tracker cannot be sustained for long.                                                                                                                                                                                                                                                                                                                                                                                      | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | n/a           |

I am not sure what to do about this yet.

[firebase pricing]: https://firebase.google.com/pricing