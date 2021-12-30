import 'package:flutter/material.dart';
import 'package:github_tracker/data/icons.dart';
import 'package:github_tracker/widgets/twitter_follow_button.dart';
import 'package:url_launcher/link.dart';

/// Button for linking to a repository on GitHub in a highlighted manner.
///
/// Note that this uses much of the styling from the [TwitterFollowButton],
/// that is just because that was already available and matches the style :)
class GitHubRepoButton extends StatelessWidget {
  /// Creates a [GitHubRepoButton] given the [username] to follow.
  const GitHubRepoButton({
    Key? key,
    required this.fullName,
  }) : super(key: key);

  /// The full name of the repository, i.e. `owner/repo`.
  final String fullName;

  @override
  Widget build(BuildContext context) {
    return Link(
      uri: Uri.parse('https://github.com/$fullName'),
      target: LinkTarget.blank,
      builder: (context, followLink) {
        return TextButton.icon(
          onPressed: followLink,
          style: TextButton.styleFrom(
            primary: Colors.white,
            backgroundColor: const Color(0xff333333),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 9,
            ),
          ),
          icon: const Icon(
            CustomIcons.github,
            size: 18,
          ),
          label: Text(
            fullName,
            style: const TextStyle(
              fontSize: 13,
            ),
          ),
        );
      },
    );
  }
}
