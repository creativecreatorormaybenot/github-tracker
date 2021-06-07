import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:github_tracker/models/repo_stats.dart';

/// Returns a stream of (todo) repo stats.
Stream<List<RepoStats>> streamRepoStats(int startPosition) {
  return FirebaseFirestore.instance
      .collection('stats')
      .orderBy('latest.position')
      .withConverter<RepoStats>(
        fromFirestore: (snapshot, _) => RepoStats.fromJson(snapshot.data()!),
        toFirestore: (value, _) => value.toJson(),
      )
      // todo: properly query.
      .startAt([startPosition])
      .limit(15)
      .snapshots()
      .map((event) => event.docs.map((e) => e.data()).toList());
}
