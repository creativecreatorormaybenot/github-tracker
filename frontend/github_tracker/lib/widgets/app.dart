import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/widgets/auth_barrier.dart';
import 'package:github_tracker/widgets/dashboard.dart';
import 'package:github_tracker/widgets/github_button.dart';
import 'package:github_tracker/widgets/twitter_follow_button.dart';

/// App entry point for the GitHub tracker app.
///
/// This should be passed as the first widget to [runApp].
class App extends StatelessWidget {
  /// Creates a [App] widget.
  const App({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: MaterialApp(
        title: Strings.appTitle,
        theme: ThemeData(
          brightness: Brightness.light,
          primarySwatch: Colors.grey,
        ),
        darkTheme: ThemeData(
          brightness: Brightness.dark,
          primarySwatch: Colors.grey,
        ),
        themeMode: ThemeMode.system,
        home: Scaffold(
          body: Stack(
            children: [
              const AuthBarrier(
                child: Center(
                  child: Dashboard(),
                ),
              ),
              Positioned(
                bottom: 16,
                left: 16,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Padding(
                      padding: EdgeInsets.only(
                        bottom: 8,
                      ),
                      child: TwitterFollowButton(
                        label: Strings.twitterFollowGhtLabel,
                        username: 'github_tracker',
                      ),
                    ),
                    TwitterFollowButton(
                      label: Strings.twitterFollowCmnLabel,
                      username: 'creativemaybeno',
                    ),
                  ],
                ),
              ),
              const Positioned(
                top: 16,
                left: 16,
                child: GitHubRepoButton(
                  fullName: 'creativecreatorormaybenot/github-tracker',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
