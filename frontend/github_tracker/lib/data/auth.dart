import 'package:firebase_auth/firebase_auth.dart';

/// Signs in the user anonymously / noop when already signed in.
///
/// Returns the a stream of the currently signed in user.
///
/// The stream *does not* update when the user signs out (never returns null
/// user).
Stream<User?> signIn() async* {
  yield FirebaseAuth.instance.currentUser;
  yield (await FirebaseAuth.instance.signInAnonymously()).user;

  await for (final user in FirebaseAuth.instance.userChanges()) {
    if (user == null) continue;
    yield user;
  }
}

/// The synchronous current user.
User? get currentUser => FirebaseAuth.instance.currentUser;
