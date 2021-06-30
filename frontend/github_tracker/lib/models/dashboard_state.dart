import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:github_tracker/models/repo_stats.dart';

part 'dashboard_state.freezed.dart';

/// Type definition for the data values carried by the [DashboardState]/
typedef DashboardData = List<RepoStats>;

// todo: this is (likely) only a temporary approach.
/// Value representing the current state of the dashboard.
@freezed
class DashboardState with _$DashboardState {
  /// Creates a [DashboardStateValue] in the loading state.
  ///
  /// The [previousData] can be optionally specified if available.
  const factory DashboardState.loading([DashboardData? previousData]) =
      DashboardLoadingState;

  /// Creates a [DashboardStateValue] in the data state.
  const factory DashboardState.data(DashboardData data) = DashboardDataState;

  /// Creates a [DashboardStateValue] in the error state.
  const factory DashboardState.error(Object error, [StackTrace? stackTrace]) =
      DashboardErrorState;
}
