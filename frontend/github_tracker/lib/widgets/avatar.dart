import 'package:flutter/material.dart';

/// Avatar widget that is modeled after the `.avatar` CSS class on `github.com`.
///
/// See https://github.com/primer/css/blob/02871c81eff68d00ea2bb11a931dd4d7162f29e7/src/avatars/avatar.scss#L1.
class Avatar extends StatelessWidget {
  /// Creates an [Avatar] widget.
  const Avatar({
    Key? key,
    required this.url,
  }) : super(key: key);

  /// The avatar image URL.
  final String url;

  @override
  Widget build(BuildContext context) {
    final size = IconTheme.of(context).size;
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Image.network(
        url,
        width: size,
        height: size,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}
