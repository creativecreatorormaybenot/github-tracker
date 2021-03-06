import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/auth.dart';

/// Provider that signs in and then provides the signed in user.
///
/// This will not update when the user is logged out (does not report `null`
/// values).
final signedInUser = StreamProvider<User>((ref) {
  return signIn().where((event) => event != null).cast();
});
