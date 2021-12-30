import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:github_tracker/widgets/repo_identifier.dart';
import 'package:github_tracker/widgets/repo_position.dart';
import 'package:github_tracker/widgets/repo_stars.dart';
import 'package:github_tracker/widgets/stats_change.dart';

/// Animated version of the [StatsTable] that animates whenever the [repoStats] change.
///
/// Note that the animation is built in a way that does not consider any change of the
/// [pageSize].
class AnimatedStatsTable extends StatefulWidget {
  /// Creates an [AnimatedStatsTable] with the given [repoStats] and [pageSize].
  const AnimatedStatsTable({
    Key? key,
    required this.repoStats,
    required this.pageSize,
  }) : super(key: key);

  /// Data / list of repo stats that should be displayed.
  ///
  /// A change of the list (comparing the first items in the lists) will trigger
  /// an animation of the full list. The slide direction of the animation is determined
  /// by comparing the position of the first items in the lists. Note that no animation
  /// will play if the position of the first items of the lists are equal.
  final List<RepoStats> repoStats;

  /// Page size used to fill remaining cells if [repoStats] does not have enough
  /// entries.
  final int pageSize;

  @override
  _AnimatedStatsTableState createState() => _AnimatedStatsTableState();
}

class _AnimatedStatsTableState extends State<AnimatedStatsTable>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    value: 1,
    duration: const Duration(seconds: 3),
  );
  late final _curvedAnimation = CurvedAnimation(
    parent: _controller,
    curve: standardEasing,
  );

  List<RepoStats>? _oldRepoStats;
  bool get _slideDown {
    if (_oldRepoStats == null) return false;

    final oldLeadingPosition = _oldRepoStats!.first.latest.position;
    final newLeadingPosition = widget.repoStats.first.latest.position;

    final slideDown = oldLeadingPosition > newLeadingPosition;
    if ((oldLeadingPosition - newLeadingPosition).abs() > widget.pageSize) {
      // If the difference between the two positions is greater than the page size,
      // we are (probably) rolling over from the last page to the first page or vise
      // versa, in which case we need to reverse the natural sliding direction.
      return !slideDown;
    }
    return slideDown;
  }

  @override
  void didUpdateWidget(covariant AnimatedStatsTable oldWidget) {
    super.didUpdateWidget(oldWidget);

    final oldLeadingPosition = oldWidget.repoStats.first.latest.position;
    final newLeadingPosition = widget.repoStats.first.latest.position;
    if (oldLeadingPosition != newLeadingPosition) {
      _oldRepoStats = List.of(oldWidget.repoStats);
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        if (_oldRepoStats != null)
          SlideTransition(
            position: _curvedAnimation.drive(
              Tween<Offset>(
                begin: Offset.zero,
                end: _slideDown ? const Offset(0, 1) : const Offset(0, -1),
              ),
            ),
            child: StatsTable(
              repoStats: _oldRepoStats!,
              pageSize: widget.pageSize,
            ),
          ),
        SlideTransition(
          position: _curvedAnimation.drive(
            Tween<Offset>(
              begin: _slideDown ? const Offset(0, -1) : const Offset(0, 1),
              end: Offset.zero,
            ),
          ),
          child: StatsTable(
            repoStats: widget.repoStats,
            pageSize: widget.pageSize,
          ),
        ),
      ],
    );
  }
}

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
