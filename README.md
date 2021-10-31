# GitHub Tracker [![GitHub Tracker web app][github tracker web app shield]][github tracker web app] [![GitHub Tracker on Twitter][github tracker twitter shield]][github tracker twitter] [![creativecreatorormaybenot on Twitter][creativemaybeno twitter shield]][creativemaybeno twitter]

Tracking the top 100 GitHub software repos.

<img width="1480" src="https://user-images.githubusercontent.com/19204050/139599401-b32e26a5-2e83-46e1-bf8f-d953a05e78ee.png">

## Web app [![GitHub Tracker web app][github tracker web app shield]][github tracker web app]

The heart of GitHub Tracker is the **Flutter web app** at
[ght.creativemaybeno.dev][github tracker web app] (alternatively at
[github-tracker.creativemaybeno.dev][github tracker web app alternative domain],
which was a little bit too verbose for me personally). Here you can view real
time data about the top 100 software repos on GitHub (current stars and
positions and how that compares daily, weekly, and monthly).

todo: insert screenshot here (link to app)

This is currently a single-page application that is Flutter-based. This single
Flutter app can be found in
[`frontend/github_tracker`][tree frontend github tracker].

## Twitter bot [![GitHub Tracker on Twitter][github tracker twitter shield]][github tracker twitter]

Another powerful feature of GitHub Tracker is the **Twitter bot** that tweets
about trackable stats (e.g. milestones, one repo surpassing another, fastest
growing repos, etc.) automatically. All tweets are posted via
[@github_tracker][github tracker twitter].

todo: insert tweet screenshot here (link to user)

This is currently part of the backend and does not yet have its own place. It
can be found in [`backend/functions`][tree backend functions].

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

## Costs

Because of costs for backend services required to operate GitHub Tracker, I am
**draining money** with this project, which is fine as I enjoy doing it.

Essentially, I need to pay GCP bills every month.  
This **limits** how much/often I can process data for GitHub Tracker etc. as I
cannot burn an unlimited amount of money for this project - although I am
willing to burn quite a bit because I _like_ the project (:

I am not sure what to do about this yet. [Let me know][dm] if you have any ideas :)

[github tracker web app]: https://ght.creativemaybeno.dev
[github tracker web app alternative domain]: https://github-tracker.creativemaybeno.dev
[github tracker web app shield]: https://img.shields.io/badge/web-app-yellow
[github tracker twitter]: https://twitter.com/github_tracker
[github tracker twitter shield]: https://img.shields.io/twitter/follow/github_tracker?label=GitHub%20Tracker&style=social
[creativemaybeno twitter]: https://twitter.com/creativemaybeno
[creativemaybeno twitter shield]: https://img.shields.io/twitter/follow/creativemaybeno?label=me&style=social
[github tracker issues]: https://github.com/creativecreatorormaybenot/github-tracker/issues
[dm]: https://creativemaybeno.dev
[tree frontend github tracker]: https://github.com/creativecreatorormaybenot/github-tracker/tree/main/frontend/github_tracker
[tree backend functions]: https://github.com/creativecreatorormaybenot/github-tracker/tree/main/backend/functions
