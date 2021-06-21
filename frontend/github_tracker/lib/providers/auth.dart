import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:github_tracker/data/auth.dart';

/// Provider that signs in and then provides the signed in user.
final signedInUser = Provider<User?>((ref) {
  final user = ref.watch(_futureUser);
  final data = user.data;

  // Try to return the user synchronously if possible.
  if (data == null) return currentUser;
  return data.value;
});

final _futureUser = FutureProvider<User>((ref) => signIn());
