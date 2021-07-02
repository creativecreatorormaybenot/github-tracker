import 'dart:math';

import 'package:flutter/material.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:github_tracker/widgets/repo_identifier.dart';
import 'package:github_tracker/widgets/repo_position.dart';
import 'package:github_tracker/widgets/repo_stars.dart';
import 'package:github_tracker/widgets/stats_change.dart';

/// Table for displaying stats of multiple repos.
class StatsTable extends StatelessWidget {
  /// Creates a [StatsTable] widget.
  const StatsTable({
    Key? key,
    required this.repoStats,
    required this.pageSize,
  }) : super(key: key);

  /// Data / list of repo stats that should be displayed.
  final List<RepoStats> repoStats;

  /// Page size used to fill remaining cells if [repoStats] does not have enough
  /// entries.
  final int pageSize;

  List<T> _fillRemaining<T>(T Function() builder) {
    return [
      for (var i = repoStats.length; i < pageSize; i++) builder(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // todo: extract/refactor this code.
        _Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          header: const Tooltip(
            message: Strings.dashboardOneDayTooltip,
            child: Text(Strings.dashboardOneDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.oneDay?.positionChange,
                arrowPosition: StatsChangeArrowPosition.back,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          header: const Tooltip(
            message: Strings.dashboardSevenDayTooltip,
            child: Text(Strings.dashboardSevenDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.sevenDay?.positionChange,
                arrowPosition: StatsChangeArrowPosition.back,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          header: const Tooltip(
            message: Strings.dashboardTwentyEightDayTooltip,
            child: Text(Strings.dashboardTwentyEightDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.twentyEightDay?.positionChange,
                arrowPosition: StatsChangeArrowPosition.back,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          header: const Text(Strings.dashboardRank),
          children: [
            for (final stats in repoStats) RepoPosition(stats: stats),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        Expanded(
          child: _Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            header: const Text(Strings.dashboardRepo),
            children: [
              for (final stats in repoStats) RepoIdentifier(stats: stats),
              ..._fillRemaining(
                () => const StatsChange(
                  change: 0,
                  arrowPosition: StatsChangeArrowPosition.front,
                ),
              ),
            ],
          ),
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          header: const Text(Strings.dashboardStars),
          children: [
            for (final stats in repoStats) RepoStars(stats: stats),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        // todo: extract/refactor this code.
        _Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          header: const Tooltip(
            message: Strings.dashboardTwentyEightDayTooltip,
            child: Text(Strings.dashboardTwentyEightDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.twentyEightDay?.starsChange,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          header: const Tooltip(
            message: Strings.dashboardSevenDayTooltip,
            child: Text(Strings.dashboardSevenDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.sevenDay?.starsChange,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
        _Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          header: const Tooltip(
            message: Strings.dashboardOneDayTooltip,
            child: Text(Strings.dashboardOneDay),
          ),
          children: [
            for (final stats in repoStats)
              StatsChange(
                change: stats.oneDay?.starsChange,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ..._fillRemaining(
              () => const StatsChange(
                change: 0,
                arrowPosition: StatsChangeArrowPosition.front,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Column extends StatelessWidget {
  const _Column({
    Key? key,
    required this.crossAxisAlignment,
    required this.header,
    required this.children,
  }) : super(key: key);

  final CrossAxisAlignment crossAxisAlignment;
  final Widget header;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: crossAxisAlignment,
      children: [
        _HeaderCell(
          child: header,
        ),
        for (final child in children)
          _Cell(
            child: child,
          ),
      ],
    );
  }
}

const _kCellPadding = EdgeInsets.symmetric(
  vertical: 2,
  horizontal: 8,
);

class _HeaderCell extends StatelessWidget {
  const _HeaderCell({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: _kCellPadding,
      child: DefaultTextStyle.merge(
        style: const TextStyle(fontWeight: FontWeight.bold),
        child: child,
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final height = max(
      // The max cell height is either the font size or icon size.
      DefaultTextStyle.of(context).style.fontSize! *
          MediaQuery.of(context).textScaleFactor,
      IconTheme.of(context).size!,
    );

    return Padding(
      padding: _kCellPadding,
      child: SizedBox(
        height: height,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Ensure that every cell is vertically centered in its row :)
            child,
          ],
        ),
      ),
    );
  }
}
