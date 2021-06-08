// ignore: avoid_web_libraries_in_flutter
import 'dart:html';

/// Removes the infinite loading animation element on web.
///
/// This is a noop on other platforms.
void removeWebLoader() {
  final loader = document.querySelector('#ghtldr');
  if (loader == null) return;
  loader.remove();
}
