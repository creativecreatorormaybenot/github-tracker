import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';

/// Avatar widget that is modeled after the `.avatar` CSS class on `github.com`.
///
/// See https://github.com/primer/css/blob/02871c81eff68d00ea2bb11a931dd4d7162f29e7/src/avatars/avatar.scss#L1.
class Avatar extends StatelessWidget {
  /// Creates an [Avatar] widget.
  const Avatar({
    Key? key,
    required this.url,
    required this.blurHash,
  }) : super(key: key);

  /// The avatar image URL.
  final String url;

  /// The blur hash to display while the image is loading.
  final String blurHash;

  @override
  Widget build(BuildContext context) {
    final size = IconTheme.of(context).size!.floorToDouble();
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Image.network(
        url,
        width: size,
        height: size,
        filterQuality: FilterQuality.medium,
        frameBuilder: (context, child, frame, _) {
          return AnimatedCrossFade(
            duration: const Duration(milliseconds: 200),
            crossFadeState: frame == null
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            firstChild: SizedBox(
              width: size,
              height: size,
              child: BlurHash(
                hash: blurHash,
                color: Colors.transparent,
                decodingWidth: size ~/ 1,
                decodingHeight: size ~/ 1,
              ),
            ),
            secondChild: child,
          );
        },
      ),
    );
  }
}
