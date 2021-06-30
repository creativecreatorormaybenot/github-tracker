import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:url_launcher/link.dart';

/// Widget for displaying a simple error code.
class ErrorCode extends StatefulWidget {
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
  State<ErrorCode> createState() => _ErrorCodeState();
}

class _ErrorCodeState extends State<ErrorCode> {
  late final _tapRecognizer = TapGestureRecognizer(debugOwner: this);

  @override
  void dispose() {
    _tapRecognizer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Link(
        uri: Uri.parse(
          'https://github.com/creativecreatorormaybenot/github-tracker/issues/new?title=[${widget.errorCode}]%20describe%20error&body=**Please%20update%20the%20title%20and%20description%20to%20describe%20the%20error%20you%20are%20experiencing%20as%20detailed%20as%20possible.**',
        ),
        target: LinkTarget.blank,
        builder: (context, followLink) {
          return Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${Strings.errorCodeError(widget.errorCode)} - ',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const TextSpan(
                  text: '${Strings.errorCodeFileIssue}\n',
                ),
                TextSpan(
                  text: 'https://github.com/creativecreatorormaybenot/'
                      'github-tracker/issues/new',
                  recognizer: _tapRecognizer..onTap = followLink,
                  style: const TextStyle(
                    // Link color from HTML living standard (https://html.spec.whatwg.org/multipage/rendering.html#phrasing-content-3).
                    color: Color(0xff0000ee),
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          );
        },
      ),
    );
  }
}
