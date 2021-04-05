import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:flutter/foundation.dart';

part 'repo_stats.freezed.dart';

part 'repo_stats.g.dart';

/// Model for stats of a single repo.
///
/// This includes so-called stats "snapshots" and also metadata.
///
/// See also:
/// * [RepoStatsSnapshot], which is the model for the stats snapshots.
/// * [RepoStatsMetadata], which is the model for the stats metadata.
// @freezed
class RepoStats with _$RepoStats {}

/// Model for the snapshot of the stats of a single repo.
///
/// The snapshot only contains a minimal amount of data. The metadata is not
/// included because it is deemed irrelevant for snapshots.
///
/// See also:
/// * [RepoStats], which is the model containing multiple of these snapshots.
@freezed
class RepoStatsSnapshot with _$RepoStatsSnapshot {
  /// Constructs a [RepoStatsSnapshot] from its values.
  @Assert('position >= 1', 'Position must be a positive integer.')
  @Assert('stars >= 0', 'Stars must be a positive integer (or zero).')
  const factory RepoStatsSnapshot({
    /// The current position of the repo (starting from 1).
    required int position,

    /// The current number of stars (stargazers count) of the repo.
    required int stars,
  }) = _RepoStatsSnapshot;

  /// Constructs a [RepoStatsSnapshot] from a JSON map.
  factory RepoStatsSnapshot.fromJson(Map<String, dynamic> json) =>
      _$RepoStatsSnapshotFromJson(json);
}

/// Model for the metadata of a single repo inside of the stats model.
///
/// This means that this is the metadata specifically used in the stats doc.
///
/// See also:
/// * [RepoStats], which is the model containing the metadata.
// @freezed
class RepoStatsMetadata with _$RepoStatsMetadata {
  /// Constructs a [RepoStatsMetadata] object from its values.
  @JsonSerializable(explicitToJson: true)
  const factory RepoStatsMetadata({
    /// The repo description.
    required String description,

    /// The full name of the repo including the repo name and the user or
    /// org name (separated by a slash).
    @JsonKey(name: 'full_name') required String fullName,

    /// The URL pointing to the GitHub repo.
    ///
    /// This is an "HTML" URL because it points to the HTML page rather than
    /// the GitHub API.
    @JsonKey(name: 'html_url') required String htmlUrl,

    /// The unique numeric identifier for the repo.
    required int id,

    /// The most used programming language in the repo.
    ///
    /// Can be `null`.
    required String? language,

    /// The repo name.
    required String name,

    /// The repo owner metadata.
    required RepoStatsMetadataOwner owner,

    /// The timestamp the [RepoStats] were taken at.
    @JsonKey(fromJson: _dateTimeFromTimestamp) required DateTime timestamp,
  }) = _RepoStatsMetadata;

  /// Constructs a [RepoStatsMetadata] object from a JSON map.
  factory RepoStatsMetadata.fromJson(Map<String, dynamic> json) =>
      _$RepoStatsMetadataFromJson(json);
}

/// Model for a repo owner as found in [RepoStatsMetadata].
///
/// This can be a user or an organization.
@freezed
class RepoStatsMetadataOwner with _$RepoStatsMetadataOwner {
  /// Constructs a [RepoStatsMetadataOwner] object from its values.
  const factory RepoStatsMetadataOwner({
    /// The image URL to the user or organization avatar.
    @JsonKey(name: 'avatar_url') required String avatarUrl,

    /// The URL pointing to the profile of the repo owner.
    ///
    /// This is an "HTML" URL because it points to the HTML page instead of
    /// the GitHub API.
    @JsonKey(name: 'html_url') required String htmlUrl,

    /// The numeric unique identifier for the user or org.
    required int id,

    /// The unique string login identifier for the user or org.
    required String login,
  }) = _RepoStatsMetadataOwner;

  /// Constructs a [RepoStatsMetadataOwner] object from a JSON map.
  factory RepoStatsMetadataOwner.fromJson(Map<String, dynamic> json) =>
      _$RepoStatsMetadataOwnerFromJson(json);
}

DateTime _dateTimeFromTimestamp(Timestamp timestamp) => timestamp.toDate();
