import 'package:flutter/material.dart';
import 'package:url_strategy/url_strategy.dart';

void main() {
  setPathUrlStrategy();

  runApp(MaterialApp(
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
    home: Scaffold(
      body: const Center(
        child: Text(
          'WIP',
          style: TextStyle(
            fontSize: 64,
          ),
        ),
      ),
    ),
  ));
}
