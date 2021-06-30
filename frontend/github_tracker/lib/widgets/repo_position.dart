import 'package:flutter/material.dart';
import 'package:github_tracker/models/repo_stats.dart';

/// Widget that displays the position information for a single repo in a
/// horizontal layout.
///
/// This is usually inserted into a stats table cell.
class RepoPosition extends StatelessWidget {
  /// Creates a [RepoPosition] widget.
  const RepoPosition({Key? key, required this.stats}) : super(key: key);

  /// The stats data for this widget.
  final RepoStats stats;

  @override
  Widget build(BuildContext context) {
    return Text(
      stats.latest.position.toString(),
    );
  }
}
