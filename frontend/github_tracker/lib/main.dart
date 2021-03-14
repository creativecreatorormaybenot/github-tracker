import 'package:flutter/material.dart';
import 'package:url_strategy/url_strategy.dart';

void main() {
  setPathUrlStrategy();

  runApp(MaterialApp(
    title: 'ght (GitHub Tracker)',
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
