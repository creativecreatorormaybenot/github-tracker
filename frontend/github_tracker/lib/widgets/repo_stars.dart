import 'package:flutter/material.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:intl/intl.dart';

/// Widget that displays the stars information for a single repo in a
/// horizontal layout.
///
/// This is usually inserted into a stats table cell.
class RepoStars extends StatelessWidget {
  /// Creates a [RepoStars] widget.
  const RepoStars({Key? key, required this.stats}) : super(key: key);

  /// The stats data for this widget.
  final RepoStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          NumberFormat().format(stats.latest.stars),
        ),
      ],
    );
  }
}
