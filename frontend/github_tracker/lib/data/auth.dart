import 'package:firebase_auth/firebase_auth.dart';

/// Signs in the user anonymously / noop when already signed in.
///
/// Returns the signed in user.
Future<User> signIn() async {
  return FirebaseAuth.instance.currentUser ??
      (await FirebaseAuth.instance.signInAnonymously()).user!;
}
