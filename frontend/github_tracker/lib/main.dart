import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:github_tracker/data/html/loader.dart';
import 'package:github_tracker/widgets/app.dart';
import 'package:url_strategy/url_strategy.dart';

void main() {
  setPathUrlStrategy();
  runApp(const App());
  SchedulerBinding.instance!.addPostFrameCallback((_) {
    // Only remove the loader after the initial frame.
    removeWebLoader();
  });
}
