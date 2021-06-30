import 'package:flutter/material.dart';
import 'package:github_tracker/data/html/loader.dart';
import 'package:github_tracker/widgets/app.dart';
import 'package:url_strategy/url_strategy.dart';

void main() {
  setPathUrlStrategy();
  removeWebLoader();
  runApp(const App());
}
