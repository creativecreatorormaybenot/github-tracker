import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/firestore/repo_stats.dart';
import 'package:github_tracker/models/repo_stats.dart';

/// Provides the up-to-date list of repo stats.
final repoStats = StreamProvider.autoDispose
    .family<List<RepoStats>, int>((ref, pos) => streamRepoStats(pos));
