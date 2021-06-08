import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/html/loader.dart';
import 'package:github_tracker/widgets/auth_barrier.dart';
import 'package:github_tracker/widgets/dashboard.dart';
import 'package:url_strategy/url_strategy.dart';

void main() {
  setPathUrlStrategy();
  removeWebLoader();

  runApp(ProviderScope(
    child: MaterialApp(
      title: 'ght (GitHub Tracker)',
      theme: ThemeData(
        brightness: Brightness.light,
        primarySwatch: Colors.grey,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.grey,
      ),
      themeMode: ThemeMode.system,
      home: const Scaffold(
        body: AuthBarrier(
          child: Center(
            child: Dashboard(),
          ),
        ),
      ),
    ),
  ));
}
