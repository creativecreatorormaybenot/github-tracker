import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/widgets/auth_barrier.dart';
import 'package:github_tracker/widgets/dashboard.dart';

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
        home: const Banner(
          message: Strings.appBannerMessage,
          location: BannerLocation.topStart,
          textStyle: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 9,
            fontWeight: FontWeight.w900,
            height: 1,
            letterSpacing: -1 / 4,
          ),
          child: Scaffold(
            body: AuthBarrier(
              child: Center(
                child: Dashboard(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
