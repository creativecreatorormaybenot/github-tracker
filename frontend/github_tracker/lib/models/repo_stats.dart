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
@freezed
class RepoStats with _$RepoStats {

}

/// Model for the snapshot of the stats of a single repo.
///
/// The snapshot only contains a minimal amount of data. The metadata is not
/// included because it is deemed irrelevant for snapshots.
///
/// See also:
/// * [RepoStats], which is the model containing multiple of these snapshots.
@freezed
class RepoStatsSnapshot with _$RepoStatSnapshot {

}

/// Model for the metadata of a single repo inside of the stats model.
///
/// This means that this is the metadata specifically used in the stats doc.
///
/// See also:
/// * [RepoStats], which is the model containing the metadata.
@freezed
class RepoStatsMetadata with _$RepoStatSnapshot {

}
