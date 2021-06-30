import 'package:flutter/material.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/widgets/link.dart';

/// Widget for displaying a simple error code.
class ErrorCode extends StatelessWidget {
  /// Creates a [ErrorCode] widget.
  const ErrorCode({Key? key, required this.errorCode}) : super(key: key);

  /// The error code to be displayed to the user.
  ///
  /// This should be in the format of `e<feature key><error number>`, where
  /// the feature key should be the least lower case letters to identify the
  /// feature and the number should simply count through the possible places
  /// errors can occur within the feature as a two digit number.
  /// For example: "ea00" for the first possible error place in auth.
  ///
  /// This is a **makeshift** solution to doing error handling.
  /// todo: properly handle errors throughout the app.
  final String errorCode;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SelectableText.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${Strings.errorCodeError(errorCode)} - ',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const TextSpan(
                  text: Strings.errorCodeFileIssue,
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          Link(
            url: 'https://github.com/creativecreatorormaybenot/github-tracker/'
                'issues/new?title=[$errorCode]%20describe%20error&'
                'body=**Please%20update%20the%20title%20and%20description%20to'
                '%20describe%20the%20error%20you%20are%20experiencing%20as%20'
                'detailed%20as%20possible.**',
            body: const Text(
              'https://github.com/creativecreatorormaybenot/'
              'github-tracker/issues/new',
            ),
          ),
        ],
      ),
    );
  }
}
