import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/models/dashboard_state.dart';
import 'package:github_tracker/providers/dashboard.dart';
import 'package:github_tracker/widgets/error_code.dart';
import 'package:github_tracker/widgets/link.dart';
import 'package:github_tracker/widgets/stats_table.dart';
import 'package:intl/intl.dart';

/// Main widget for the main dashboard displaying repo stats.
class Dashboard extends ConsumerWidget {
  /// Constructs a [Dashboard] widget.
  const Dashboard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dashboardProvider);

    if (state is DashboardErrorState) {
      return const ErrorCode(
        errorCode: 'ed00',
      );
    }

    final data = state is DashboardDataState
        ? state.data
        : state is DashboardLoadingState
            ? state.previousData
            : null;
    return FocusableActionDetector(
      autofocus: true,
      shortcuts: {
        LogicalKeySet(LogicalKeyboardKey.arrowUp): const ScrollIntent(
          direction: AxisDirection.up,
        ),
        LogicalKeySet(LogicalKeyboardKey.arrowDown): const ScrollIntent(
          direction: AxisDirection.down,
        ),
        LogicalKeySet(LogicalKeyboardKey.arrowLeft): const ScrollIntent(
          direction: AxisDirection.left,
        ),
        LogicalKeySet(LogicalKeyboardKey.arrowRight): const ScrollIntent(
          direction: AxisDirection.right,
        ),
        LogicalKeySet(LogicalKeyboardKey.pageUp): const ScrollIntent(
          direction: AxisDirection.up,
          type: ScrollIncrementType.page,
        ),
        LogicalKeySet(LogicalKeyboardKey.pageDown): const ScrollIntent(
          direction: AxisDirection.down,
          type: ScrollIncrementType.page,
        ),
      },
      actions: {
        ScrollIntent: CallbackAction<ScrollIntent>(
          onInvoke: (intent) {
            if (state is DashboardLoadingState) return;
            switch (intent.direction) {
              case AxisDirection.down:
              case AxisDirection.right:
                ref.read(dashboardProvider.notifier).updatePage(1);
                break;
              case AxisDirection.up:
              case AxisDirection.left:
                ref.read(dashboardProvider.notifier).updatePage(-1);
                break;
            }
          },
        ),
      },
      child: Stack(
        children: [
          if (data != null)
            ConstrainedBox(
              constraints: BoxConstraints(
                // todo: find a better layout approach :)
                maxWidth: 420 + 420 * MediaQuery.textScaleFactorOf(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MouseRegion(
                    // This does not update visually when mouse is not moved.
                    // todo: create flutter/flutter issue for this.
                    cursor: state is DashboardLoadingState
                        ? SystemMouseCursors.wait
                        : SystemMouseCursors.click,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: state is DashboardLoadingState
                          ? null
                          : () {
                              ref
                                  .read(dashboardProvider.notifier)
                                  .updatePage(1);
                            },
                      child: StatsTable(
                        repoStats: data,
                        pageSize:
                            ref.watch(dashboardProvider.notifier).pageSize,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(
                      left: 8,
                      top: 32,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SelectableText(
                          Strings.dashboardFooter(
                            DateFormat('HH:mm, MMMM d, y')
                                .format(data.first.metadata.timestamp),
                          ),
                          style: Theme.of(context).textTheme.caption,
                        ),
                        const Link(
                          url: Strings.dashboardFooterLink,
                          body: Text(Strings.dashboardFooterLink),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (state is DashboardLoadingState)
            Positioned.fill(
              child: Align(
                alignment:
                    data == null ? Alignment.center : Alignment.bottomRight,
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text(Strings.dashboardLoadingData),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
