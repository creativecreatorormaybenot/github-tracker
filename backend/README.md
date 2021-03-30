# backend

The `backend` of GitHub Tracker hosts all data operations and the [Twitter bot][github tracker twitter].

→ [![GitHub Tracker on Twitter][github tracker twitter shield]][github tracker twitter]

## Data

Triggered by a CRON job, GitHub Tracker continuously stores information about the top 100 software repos.

Additionally, it populates data for the `frontend`, which is an agglomeration of the historical data that
is updated with each fetch of new data. Note that the Twitter bot makes use of the same historical data.

### Missing data

It might be that once in a while some data goes missing. This is not due to magic, of course. Instead,
there might be a bug in GitHub Tracker for example that disables the collection of historical data for
some period of time (e.g. API calls that are not succeeding).

For every occurrence of this, I have created an issue on the repo. In this issues I describe the bug at
hand and also document in what period of time data went missing:
[issues filtered by label][github tracker missing data].

Generally speaking, GitHub Tracker has stored repo data about the top 100 repos continuously, at least
once per hour, since 2021/02/28 7:00 UTC. The exceptions can be found in the issues linked above. I will
also try to keep the list updated here:

- 2021/03/16 07:15 UTC (last data point) → 2021/03/17 00:15 UTC (first data point)

The "last data point" indicates the last point in time that data was successfully tracked before the bug
caused missing data and the "first data point" indicates the point in time when tracking worked without
incidents again.

[github tracker twitter]: https://twitter.com/github_tracker
[github tracker twitter shield]: https://img.shields.io/twitter/follow/github_tracker?label=GitHub%20Tracker&style=social
[github tracker missing data]: https://github.com/creativecreatorormaybenot/github-tracker/issues?q=is%3Aissue+label%3A%22missing+data%22+sort%3Acreated-asc
