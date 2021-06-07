import 'package:firebase_auth/firebase_auth.dart';

/// Signs in the user anonymously/
Future<void> signIn() async {
  await FirebaseAuth.instance.signInAnonymously();
}
