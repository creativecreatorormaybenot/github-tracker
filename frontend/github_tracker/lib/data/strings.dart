/// Placeholder (namespace) for all string resources.
///
/// This serves the purpose of collecting all strings used in the UI
/// (presentation layer if we had separation), in case we want to localize
/// in the future (or similar).
class Strings {
  // -------------------------------- Dashboard --------------------------------

  /// Header for the rank column on the dashboard.
  static const dashboardRank = 'Rank';

  /// Header for the repo column on the dashboard.
  static const dashboardRepo = 'Repo';

  /// Header for the stars column on the dashboard.
  static const dashboardStars = 'Stars';

  /// Footer text on the dashboard
  static dashboardFooter(String date) => 'Source: GitHub, $date. '
      'Excludes content-only repos (includes only software repos).\n'
      'https://github.com/creativecreatorormaybenot/github-tracker';

  // ------------------------------ Auth barrier -------------------------------

  /// Message that is displayed while showing the auth barrier.
  static const authBarrierMessage = 'Securing access for first-time session...';

  // ------------------------------- Error code --------------------------------

  /// Error code message for an error that has occurred.
  static errorCodeError(String errorCode) => 'error: $errorCode';

  /// Call to action to file an issue when an error code is shown.
  static const errorCodeFileIssue = 'please find or file an issue on GitHub (:';
}
