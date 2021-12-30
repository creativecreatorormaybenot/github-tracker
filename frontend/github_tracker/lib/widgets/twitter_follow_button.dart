import 'package:flutter/material.dart';
import 'package:github_tracker/data/icons.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:url_launcher/link.dart';

/// Widget that resembles the official Twitter follow button.
///
/// See https://developer.twitter.com/en/docs/twitter-for-websites/follow-button/overview
/// for reference. The HTML/JS-based button might change in the future while this button
/// will obviously remain the same without manual adjustment.
class TwitterFollowButton extends StatelessWidget {
  /// Creates a [TwitterFollowButton] given the [username] to follow.
  const TwitterFollowButton({
    Key? key,
    required this.username,
  }) : super(key: key);

  /// The username/handle of the user to follow on Twitter.
  final String username;

  @override
  Widget build(BuildContext context) {
    return Link(
      uri: Uri.parse('https://twitter.com/intent/follow?screen_name=$username'),
      target: LinkTarget.blank,
      builder: (context, followLink) {
        return TextButton.icon(
          onPressed: followLink,
          style: TextButton.styleFrom(
            primary: Colors.white,
            backgroundColor: const Color(0xff1d9bf0),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 9,
            ),
          ),
          icon: const Icon(
            CustomIcons.twitter,
            size: 18,
          ),
          label: Text(
            Strings.twitterFollowButtonLabel(username),
            style: const TextStyle(
              fontSize: 13,
            ),
          ),
        );
      },
    );
  }
}
