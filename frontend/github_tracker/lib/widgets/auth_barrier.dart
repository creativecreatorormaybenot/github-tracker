import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/strings.dart';
import 'package:github_tracker/providers/auth.dart';
import 'package:github_tracker/widgets/error_code.dart';

/// A widget that enforces a barrier requiring authentication.
///
/// What this means is that [child] is only returned once the user is
/// authenticated / authorized to use the app.
/// This widget also initiates the sign in by watching the [signedInUser].
class AuthBarrier extends ConsumerWidget {
  /// Creates an [AuthBarrier] widget.
  const AuthBarrier({Key? key, required this.child}) : super(key: key);

  /// Child widget that is only returned once the user is signed in.
  ///
  /// This enforces that the [child] content cannot be reached without
  /// authorization (assuming authorization only requires authentication).
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(signedInUser);

    return user.when(
      data: (user) => child,
      loading: () => const _BarrierPlaceholder(),
      error: (_, __) {
        print('AuthBarrier.build $_ $__');
        return const ErrorCode(
          errorCode: 'ea00',
        );
      },
    );
  }
}

class _BarrierPlaceholder extends StatelessWidget {
  const _BarrierPlaceholder({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(Strings.authBarrierMessage),
    );
  }
}
