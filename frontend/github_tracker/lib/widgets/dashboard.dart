import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/providers/dashboard.dart';
import 'package:github_tracker/widgets/link.dart';
import 'package:github_tracker/widgets/stats_table.dart';
import 'package:intl/intl.dart';

/// Main widget for the main dashboard displaying repo stats.
class Dashboard extends ConsumerWidget {
  /// Constructs a [Dashboard] widget.
  const Dashboard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dataTimestamp = ref.watch(repoStatsProvider.select((repoStats) {
      return repoStats.value?.first.metadata.timestamp;
    }));
    if (dataTimestamp == null) {
      return const Center(
        child: Text(Strings.dashboardLoadingData),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(
        top: 48,
        bottom: 96,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          // todo: find a better layout approach :)
          maxWidth: 420 + 420 * MediaQuery.textScaleFactorOf(context),
          maxHeight: 280 + 280 * MediaQuery.textScaleFactorOf(context),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _TableHeader(),
            const Expanded(
              child: RepoStatsTable(),
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
                      DateFormat('HH:mm, MMMM d, y').format(dataTimestamp),
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
    );
  }
}

class _TableHeader extends StatelessWidget {
  const _TableHeader({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        bottom: 16,
      ),
      child: Text(
        Strings.dashboardTableTitle,
        style: Theme.of(context).textTheme.headline4,
      ),
    );
  }
}
