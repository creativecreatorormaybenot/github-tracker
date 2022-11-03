import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:github_tracker/providers/dashboard.dart';
import 'package:github_tracker/widgets/repo_identifier.dart';
import 'package:github_tracker/widgets/repo_position.dart';
import 'package:github_tracker/widgets/repo_stars.dart';
import 'package:github_tracker/widgets/stats_change.dart';

/// Table for displaying the stats of all repos.
class RepoStatsTable extends ConsumerWidget {
  const RepoStatsTable({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repoStats = ref.watch(repoStatsProvider).value ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.end,
              widthChild: _PositionChangeWidth(),
              tooltipMessage: Strings.dashboardOneDayTooltip,
              child: Text(Strings.dashboardOneDay),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.end,
              widthChild: _PositionChangeWidth(),
              tooltipMessage: Strings.dashboardSevenDayTooltip,
              child: Text(Strings.dashboardSevenDay),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.end,
              widthChild: _PositionChangeWidth(),
              tooltipMessage: Strings.dashboardTwentyEightDayTooltip,
              child: Text(Strings.dashboardTwentyEightDay),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.end,
              widthChild: _RankWidth(),
              child: Text(Strings.dashboardRank),
            ),
            Expanded(
              child: _HeaderCell(
                crossAxisAlignment: CrossAxisAlignment.start,
                widthChild: SizedBox.expand(),
                child: Text(Strings.dashboardRepo),
              ),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.start,
              widthChild: _StarsWidth(),
              child: Text(Strings.dashboardStars),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.start,
              widthChild: _StarsChangeWidth(),
              tooltipMessage: Strings.dashboardTwentyEightDayTooltip,
              child: Text(Strings.dashboardTwentyEightDay),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.start,
              widthChild: _StarsChangeWidth(),
              tooltipMessage: Strings.dashboardSevenDayTooltip,
              child: Text(Strings.dashboardSevenDay),
            ),
            _HeaderCell(
              crossAxisAlignment: CrossAxisAlignment.start,
              widthChild: _StarsChangeWidth(),
              tooltipMessage: Strings.dashboardOneDayTooltip,
              child: Text(Strings.dashboardOneDay),
            ),
          ],
        ),
        Expanded(
          child: ListView.builder(
            itemCount: repoStats.length,
            itemBuilder: (context, index) {
              return _StatsRow(
                stats: repoStats[index],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({
    required this.stats,
  });

  final RepoStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.end,
          widthChild: const _PositionChangeWidth(),
          child: StatsChange(
            change: stats.oneDay?.positionChange,
            arrowPosition: StatsChangeArrowPosition.back,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.end,
          widthChild: const _PositionChangeWidth(),
          child: StatsChange(
            change: stats.sevenDay?.positionChange,
            arrowPosition: StatsChangeArrowPosition.back,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.end,
          widthChild: const _PositionChangeWidth(),
          child: StatsChange(
            change: stats.twentyEightDay?.positionChange,
            arrowPosition: StatsChangeArrowPosition.back,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.end,
          widthChild: const _RankWidth(),
          child: RepoPosition(
            stats: stats,
          ),
        ),
        Expanded(
          child: _Cell(
            crossAxisAlignment: CrossAxisAlignment.start,
            widthChild: const SizedBox.expand(),
            child: RepoIdentifier(
              stats: stats,
            ),
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.start,
          widthChild: const _StarsWidth(),
          child: RepoStars(
            stats: stats,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.start,
          widthChild: const _StarsChangeWidth(),
          child: StatsChange(
            change: stats.twentyEightDay?.starsChange,
            arrowPosition: StatsChangeArrowPosition.front,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.start,
          widthChild: const _StarsChangeWidth(),
          child: StatsChange(
            change: stats.sevenDay?.starsChange,
            arrowPosition: StatsChangeArrowPosition.front,
          ),
        ),
        _Cell(
          crossAxisAlignment: CrossAxisAlignment.start,
          widthChild: const _StarsChangeWidth(),
          child: StatsChange(
            change: stats.oneDay?.starsChange,
            arrowPosition: StatsChangeArrowPosition.front,
          ),
        ),
      ],
    );
  }
}

class _HeaderCell extends StatelessWidget {
  const _HeaderCell({
    required this.crossAxisAlignment,
    required this.widthChild,
    this.tooltipMessage,
    required this.child,
  });

  /// See [_Cell.crossAxisAlignment].
  final CrossAxisAlignment crossAxisAlignment;

  /// See [_Cell.widthChild].
  final Widget widthChild;

  final String? tooltipMessage;

  /// The bold heading for the cell column.
  ///
  /// This is usually a [Text] widget and formatted via [DefaultTextStyle].
  final Widget child;

  @override
  Widget build(BuildContext context) {
    Widget result = DefaultTextStyle.merge(
      style: const TextStyle(
        fontWeight: FontWeight.bold,
      ),
      child: child,
    );

    if (tooltipMessage != null) {
      result = Tooltip(
        message: tooltipMessage,
        child: result,
      );
    }

    return _Cell(
      crossAxisAlignment: crossAxisAlignment,
      widthChild: widthChild,
      child: result,
    );
  }
}

const _kCellPadding = EdgeInsets.symmetric(
  vertical: 2,
  horizontal: 8,
);

class _Cell extends StatelessWidget {
  const _Cell({
    required this.crossAxisAlignment,
    required this.widthChild,
    required this.child,
  });

  /// The cross axis alignment of the [child] within the cell.
  ///
  /// This must be one of [CrossAxisAlignment.start] and
  /// [CrossAxisAlignment.end].
  final CrossAxisAlignment crossAxisAlignment;

  /// Widget that determines the width of this cell.
  ///
  /// This is passed in order to give all cells in a column the same width
  /// without knowing the width pre-layout.
  /// This asserts that no cell in that column exceeds the given width of the
  /// given width child.
  ///
  /// The [widthChild] is inserted with 0 opacity.
  final Widget widthChild;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    assert(crossAxisAlignment == CrossAxisAlignment.start ||
        crossAxisAlignment == CrossAxisAlignment.end);
    final height = max(
      // The max cell height is either the font size or icon size.
      DefaultTextStyle.of(context).style.fontSize! *
          MediaQuery.of(context).textScaleFactor,
      IconTheme.of(context).size!,
    );

    return Padding(
      padding: _kCellPadding,
      child: Stack(
        children: [
          SizedBox(
            height: height,
            child: Opacity(
              opacity: 0,
              child: widthChild,
            ),
          ),
          Positioned.fill(
            left: crossAxisAlignment == CrossAxisAlignment.start ? 0 : null,
            right: crossAxisAlignment == CrossAxisAlignment.end ? 0 : null,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Ensure that every cell is vertically centered in its row :)
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Widget that defines the max width of a position change + some extra padding.
class _PositionChangeWidth extends StatelessWidget {
  const _PositionChangeWidth();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(
        left: 12,
      ),
      child: StatsChange(
        // A change of more than 99 positions is not possible.
        change: 99,
        arrowPosition: StatsChangeArrowPosition.back,
      ),
    );
  }
}

/// Widget that defines the max width of a rank cell + some extra padding.
class _RankWidth extends StatelessWidget {
  const _RankWidth();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(
        left: 8,
      ),
      child: Text('100'),
    );
  }
}

/// Widget that defines the max width of a repo's stars count + some extra
/// padding.
class _StarsWidth extends StatelessWidget {
  const _StarsWidth();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(
        right: 8,
      ),
      // No software repo will cross 1M stars in the foreseeable future.
      // The max stars as of now are 200,440 (vuejs/vue).
      child: Text('999,999'),
    );
  }
}

/// Widget that defines the max width of a stars change + some extra padding.
class _StarsChangeWidth extends StatelessWidget {
  const _StarsChangeWidth();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(
        right: 8,
      ),
      child: StatsChange(
        // This is displayed as "99.9K" and is the longest possible string in my
        // testing.
        change: 99900,
        arrowPosition: StatsChangeArrowPosition.front,
      ),
    );
  }
}
