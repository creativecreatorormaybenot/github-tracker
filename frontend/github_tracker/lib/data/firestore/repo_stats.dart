import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:github_tracker/models/repo_stats.dart';

/// Returns a stream of a single page of repo stats.
///
/// The page starts at the given [startPosition] (repo position) and includes
/// a number of [pageSize] repos in total. The number of returned elements may
/// be less than [pageSize] if the last page is reached.
Stream<List<RepoStats>> streamRepoStats(int startPosition, int pageSize) {
  return FirebaseFirestore.instance
      .collection('stats')
      .orderBy('latest.position')
      .withConverter<RepoStats>(
        fromFirestore: (snapshot, _) => RepoStats.fromJson(snapshot.data()!),
        toFirestore: (value, _) => value.toJson(),
      )
      .startAt([startPosition])
      .limit(pageSize)
      .snapshots()
      .map((event) => event.docs.map((e) => e.data()).toList());
}
