import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/providers/dashboard.dart';
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
            final starsFormat = NumberFormat();

            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() {
                  _page = _page % 7 + 1;
                });
              },
              child: Center(
                child: FractionallySizedBox(
                  widthFactor: 1 / 2,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          // todo: extract these columns.
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Padding(
                                padding: EdgeInsets.symmetric(
                                  vertical: 4,
                                  horizontal: 8,
                                ),
                                child: Text(
                                  Strings.dashboardRank,
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
                              for (final stats in data)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 4,
                                    horizontal: 8,
                                  ),
                                  child: Text(
                                    stats.latest.position.toString(),
                                  ),
                                ),
                            ],
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.symmetric(
                                    vertical: 4,
                                    horizontal: 8,
                                  ),
                                  child: Text(
                                    Strings.dashboardRepo,
                                    style:
                                        TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
                                for (final stats in data)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 4,
                                      horizontal: 8,
                                    ),
                                    child: Row(
                                      children: [
                                        Image.network(
                                          stats.metadata.owner.avatarUrl,
                                          width: DefaultTextStyle.of(context)
                                              .style
                                              .fontSize,
                                          height: DefaultTextStyle.of(context)
                                              .style
                                              .fontSize,
                                          filterQuality: FilterQuality.medium,
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            left: 4,
                                          ),
                                          child: Text(stats.metadata.fullName),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Padding(
                                padding: EdgeInsets.symmetric(
                                  vertical: 4,
                                  horizontal: 8,
                                ),
                                child: Text(
                                  Strings.dashboardStars,
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
                              for (final stats in data)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 4,
                                    horizontal: 8,
                                  ),
                                  child: Text(
                                    starsFormat.format(stats.latest.stars),
                                  ),
                                ),
                            ],
                          ),
                        ],
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
              ),
            );
          },
        );
      },
    );
  }
}
