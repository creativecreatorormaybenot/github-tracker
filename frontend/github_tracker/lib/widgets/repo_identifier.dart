import 'package:flutter/material.dart';
import 'package:github_tracker/models/repo_stats.dart';
import 'package:github_tracker/widgets/avatar.dart';
import 'package:url_launcher/link.dart';
import 'package:url_launcher/link.dart' as ull;

/// Widget that displays the identifier information for a single repo in a
/// horizontal layout.
///
/// This includes the owner avatar, owner name, and repo name.
///
/// This is usually inserted into a stats table cell.
class RepoIdentifier extends StatelessWidget {
  /// Creates a [RepoIdentifier] widget.
  const RepoIdentifier({Key? key, required this.stats}) : super(key: key);

  /// The stats data for this widget.
  final RepoStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Avatar(
          url: stats.metadata.owner.avatarUrl,
          blurHash: stats.metadata.owner.avatarBlurHash,
        ),
        Padding(
          padding: const EdgeInsets.only(
            left: 6,
          ),
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: ull.Link(
              uri: Uri.tryParse(stats.metadata.htmlUrl),
              target: LinkTarget.blank,
              builder: (context, followLink) {
                return GestureDetector(
                  onTap: followLink,
                  child: Text(stats.metadata.fullName),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
