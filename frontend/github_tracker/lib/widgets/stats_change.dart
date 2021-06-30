import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Enumeration of possible position the arrow in a [StatsChange] can assume.
enum StatsChangeArrowPosition {
  /// The arrow is placed before the change text.
  front,

  /// The arrow is placed after the change text.
  back,
}

/// Widget that displays the change in stats (of a single value) in a styled
/// manner.
class StatsChange extends StatelessWidget {
  /// Creates a [StatsChange] widget.
  const StatsChange({
    Key? key,
    required this.change,
    required this.arrowPosition,
  }) : super(key: key);

  /// The change value.
  ///
  /// If this is `null`, "N/A" is displayed.
  ///
  /// If this is `0`, no change is displayed (just a dash).
  ///
  /// Otherwise, an arrow with the appropriate semantic direction (up for
  /// positive change and down for negative change) is shown along with the
  /// actual (formatted) value.
  final int? change;

  /// Position of the arrow that is shown along with the change relative to the
  /// position of the [change] text.
  final StatsChangeArrowPosition arrowPosition;

  @override
  Widget build(BuildContext context) {
    // Allow promoting (null-safety) change.
    final change = this.change;
    if (change == null) {
      // todo: find better handling for this case.
      return const Text('N/A');
    }

    if (change == 0) {
      // todo: find better handling for this case or move to Strings.
      return const Text('–');
    }

    final Color color;
    if (change < 0) {
      color = Theme.of(context).colorScheme.error;
    } else {
      color = Colors.green[700]!;
    }

    var inlineSpans = [
      WidgetSpan(
        alignment:
            change < 0 ? PlaceholderAlignment.bottom : PlaceholderAlignment.top,
        baseline: TextBaseline.alphabetic,
        child: RotatedBox(
          quarterTurns: change < 0 ? 1 : -1,
          child: Text(
            String.fromCharCode(Icons.arrow_right_alt.codePoint),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontFamily: Icons.arrow_right_alt.fontFamily,
              package: Icons.arrow_right_alt.fontPackage,
              color: color,
            ),
          ),
        ),
      ),
      TextSpan(
        text: NumberFormat.compact().format(change),
      ),
    ];
    if (arrowPosition == StatsChangeArrowPosition.back) {
      inlineSpans = inlineSpans.reversed.toList();
    }

    return Text.rich(
      TextSpan(
        children: inlineSpans,
        style: TextStyle(
          color: color,
        ),
      ),
    );
  }
}
