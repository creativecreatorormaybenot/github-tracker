import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:github_tracker/data/html/loader.dart';
import 'package:github_tracker/firebase_options.dart';
import 'package:github_tracker/widgets/app.dart';
import 'package:url_strategy/url_strategy.dart';

void main() async {
  setPathUrlStrategy();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const App());
  _binding!.addPostFrameCallback((_) {
    // Only remove the loader after the initial frame.
    removeWebLoader();
  });
}

// Temporary workaround for making analysis pass both on stable and beta/master
// as SchedulerBinding.instance is not nullable on beta/master.
// See https://github.com/creativecreatorormaybenot/github-tracker/runs/6142829858?check_suite_focus=true.
SchedulerBinding? get _binding => SchedulerBinding.instance;
