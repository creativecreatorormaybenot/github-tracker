import 'package:flutter_test/flutter_test.dart';
import 'package:github_tracker/models/repo_stats.dart';

void main() {
  group('$RepoStatsSnapshot', () {
    test('fails with invalid position', () {
      expect(
        () => RepoStatsSnapshot(
          position: 0,
          stars: 42,
          positionChange: 0,
          starsChange: 0,
        ),
        throwsAssertionError,
      );
      expect(
        () => RepoStatsSnapshot(
          position: -1,
          stars: 42,
          positionChange: 0,
          starsChange: 0,
        ),
        throwsAssertionError,
      );
    });

    test('fails with invalid stars', () {
      expect(
        () => RepoStatsSnapshot(
          position: 42,
          stars: -1,
          positionChange: 0,
          starsChange: 0,
        ),
        throwsAssertionError,
      );
      expect(
        () => RepoStatsSnapshot(
          position: 42,
          stars: -42,
          positionChange: 0,
          starsChange: 0,
        ),
        throwsAssertionError,
      );
    });

    test('parses JSON correctly', () {
      expect(
        RepoStatsSnapshot.fromJson({
          'position': 1,
          'stars': 42,
          'positionChange': 0,
          'starsChange': 0,
        }),
        const RepoStatsSnapshot(
          position: 1,
          stars: 42,
          positionChange: 0,
          starsChange: 0,
        ),
      );
    });
  });
}
