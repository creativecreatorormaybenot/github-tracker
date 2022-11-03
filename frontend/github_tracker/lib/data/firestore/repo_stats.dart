import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:github_tracker/models/repo_stats.dart';

/// Returns a stream of all repo stats.
Stream<List<RepoStats>> streamRepoStats(FirebaseFirestore firestore) {
  final querySnapshots = firestore
      .collection('stats')
      .orderBy('latest.position')
      .withConverter<RepoStats>(
        fromFirestore: (snapshot, _) => RepoStats.fromJson(snapshot.data()!),
        toFirestore: (value, _) => value.toJson(),
      )
      .snapshots();
  return querySnapshots.map((querySnapshot) {
    return [for (final snapshot in querySnapshot.docs) snapshot.data()];
  });
}
