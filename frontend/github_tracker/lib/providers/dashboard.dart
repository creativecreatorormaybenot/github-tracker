import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/firestore/repo_stats.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:github_tracker/providers/firestore.dart';

/// Provider that provides a stream of all repo stats.
final repoStatsProvider = StreamProvider<List<RepoStats>>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return streamRepoStats(firestore);
});
