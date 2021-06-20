import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/providers/dashboard.dart';
import 'package:github_tracker/widgets/stats_table.dart';
import 'package:intl/intl.dart';

/// Main widget for the main dashboard displaying repo stats.
class Dashboard extends StatefulWidget {
  /// Constructs a [Dashboard] widget.
  const Dashboard({Key? key}) : super(key: key);

  @override
  State<Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<Dashboard> {
  var _page = 1;

  @override
  Widget build(BuildContext context) {
    // todo: completely remove this.
    // We do not want to have the pagination like this - this is only for
    // prototyping / debugging.
    // And also we would not want to handle the state here.
    return Consumer(
      builder: (context, watch, child) {
        final stats = watch(repoStats((_page - 1) * 15 + 1));

        // todo: refactor this - I hate this syntax.
        // This syntax is only acceptable if it directly returns extracted
        // widgets.
        return stats.when(
          loading: () {
            return const SizedBox();
          },
          error: (error, stackTrace) {
            return ErrorWidget(error);
          },
          data: (data) {
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() {
                  _page = _page % 7 + 1;
                });
              },
              child: FractionallySizedBox(
                widthFactor: 1 / 2,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatsTable(
                      repoStats: data,
                    ),
                    Padding(
                      padding: const EdgeInsets.only(
                        left: 8,
                        top: 32,
                      ),
                      child: Text(
                        Strings.dashboardFooter(
                          DateFormat('HH:mm, MMMM d, y')
                              .format(data.first.metadata.timestamp),
                        ),
                        style: Theme.of(context).textTheme.caption,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
