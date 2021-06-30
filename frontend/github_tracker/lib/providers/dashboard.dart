import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/firestore/repo_stats.dart';
import 'package:github_tracker/models/dashboard_state.dart';

/// Provides the [DashboardNotifier]
final dashboardProvider =
    StateNotifierProvider<DashboardNotifier, DashboardState>((ref) {
  return DashboardNotifier._()..init();
});

/// Notifier that informs the dashboard about its current state.
class DashboardNotifier extends StateNotifier<DashboardState> {
  DashboardNotifier._() : super(const DashboardState.loading());

  StreamSubscription? _streamSubscription;

  var _page = 0;

  // todo: refactor paging (this is only for developing purposes).
  static const _resultsPerPage = 15, _totalResults = 100;

  /// Initializes the notifier by listening to the initial page (0).
  void init() {
    _updateStream();
  }

  /// Updates the current page by the given [pageChange] (where `1` means next
  /// page) and starts listening for new data.
  void updatePage(int pageChange) {
    assert(mounted);
    _page = (_page + pageChange) % (_totalResults / _resultsPerPage).ceil();
    _updateStream();

    // If we are not already in a loading state, make sure to enter one.
    final previousState = state;
    if (previousState is DashboardDataState) {
      state = DashboardState.loading(previousState.data);
    } else if (previousState is DashboardErrorState) {
      state = const DashboardState.loading();
    }
  }

  void _updateStream() {
    final stream =
        streamRepoStats(_page * _resultsPerPage + 1, _resultsPerPage);
    _streamSubscription?.cancel();
    _streamSubscription = stream.listen(
      (event) {
        state = DashboardState.data(event);
      },
      onError: (error, stackTrace) {
        state = DashboardState.error(error, stackTrace);
      },
    );
  }

  @override
  void dispose() {
    _streamSubscription?.cancel();
    super.dispose();
  }
}
