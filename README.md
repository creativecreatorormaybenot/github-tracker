# GitHub Tracker [![GitHub Tracker web app][github tracker web app shield]][github tracker web app] [![GitHub Tracker on Twitter][github tracker twitter shield]][github tracker twitter] [![creativecreatorormaybenot on Twitter][creativemaybeno twitter shield]][creativemaybeno twitter]

Tracking the top 100 GitHub software repos.

## Web app [![GitHub Tracker web app][github tracker web app shield]][github tracker web app]

The heart of GitHub Tracker is the **Flutter web app** at
[ght.creativemaybeno.dev][github tracker web app] (alternatively at
[github-tracker.creativemaybeno.dev][github tracker web app alternative domain],
which was a little bit too verbose for me personally). Here you can view real
time data about the top 100 software repos on GitHub (current stars and
positions and how that compares daily, weekly, and monthly).

[![image](https://user-images.githubusercontent.com/19204050/147398194-cc98c935-e537-4278-9654-3800ed827a0a.png)][github tracker web app]

This is currently a single-page application that is Flutter-based. This single
Flutter app can be found in
[`frontend/github_tracker`][tree frontend github tracker].

## Twitter bot [![GitHub Tracker on Twitter][github tracker twitter shield]][github tracker twitter]

Another powerful feature of GitHub Tracker is the **Twitter bot** that tweets
about trackable stats (e.g. milestones, one repo surpassing another, fastest
growing repos, etc.) automatically. All tweets are posted via
[@github_tracker][github tracker twitter].

[![image](https://user-images.githubusercontent.com/19204050/147715832-35f2d2a9-22d8-466f-9339-c18c0f9655f5.png)](https://twitter.com/github_tracker/status/1371272507827847172?s=20)

This is currently part of the backend and does not yet have its own place. It
can be found in [`backend/functions`][tree backend functions].

## Software repos

Note that GitHub Tracker exclusively tracks **software repos**. This is inspired
by [timsneath's `github-tracker`](https://github.com/timsneath/github-tracker) where
there is a defined list of **content repos** (repositories that do not develop any
actual software but only provide content, e.g. articles and such) that are excluded
from tracking.

The source of truth for content repos can be found in
[`content-repos.ts`][content repos backend]. Please feel free to open a pull request
in case the list is not accurate or a content repo is missing.

## Contributing

Any contributions to this project are more than welcome! If you want to help,
feel free to give it a shot :)

The easiest way for you to make contributions is opening issues or preferrably
if similar issues already exist, upvote them and/or join the discussion. You
can find existing issues and open new issues in the
[issues tab of this repo][github tracker issues].

If you feel like there is any information missing for you to make a contribution
in the form of a pull request, please feel free to create an issue for that as
well. I guess I will have to figure out what contributing information
(as in documentation) is required to make PRs on such a project.

## Support

If you want to support my work on this project and alleviate some of the backend costs for running
GitHub tracker, you can consider [becoming a sponsor][github sponsors] :)

[github tracker web app]: https://ght.creativemaybeno.dev
[github tracker web app alternative domain]: https://github-tracker.creativemaybeno.dev
[github tracker web app shield]: https://img.shields.io/badge/web-app-yellow
[github tracker twitter]: https://twitter.com/github_tracker
[github tracker twitter shield]: https://img.shields.io/twitter/follow/github_tracker?label=GitHub%20Tracker&style=social
[creativemaybeno twitter]: https://twitter.com/creativemaybeno
[creativemaybeno twitter shield]: https://img.shields.io/twitter/follow/creativemaybeno?label=me&style=social
[github tracker issues]: https://github.com/creativecreatorormaybenot/github-tracker/issues
[tree frontend github tracker]: https://github.com/creativecreatorormaybenot/github-tracker/tree/main/frontend/github_tracker
[tree backend functions]: https://github.com/creativecreatorormaybenot/github-tracker/tree/main/backend/functions
[github sponsors]: https://github.com/sponsors/creativecreatorormaybenot
[content repos backend]: https://github.com/creativecreatorormaybenot/github-tracker/blob/main/backend/functions/src/content-repos.ts#L20
