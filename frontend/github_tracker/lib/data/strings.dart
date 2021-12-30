/// Placeholder (namespace) for all string resources.
///
/// This serves the purpose of collecting all strings used in the UI
/// (presentation layer if we had separation), in case we want to localize
/// in the future (or similar).
class Strings {
  // ----------------------------------- App -----------------------------------

  /// Title for the app.
  static const appTitle = 'ght (GitHub Tracker)';

  /// Banner message that is displayed for about the whole app, currently
  /// indicating the preview status of the whole app.
  static const appBannerMessage = 'DEV PREVIEW';

  // -------------------------------- Dashboard --------------------------------

  /// Title for the table on the dashboard.
  static const dashboardTableTitle = 'Top Software Repos on GitHub';

  /// Header for the rank column on the dashboard.
  static const dashboardRank = 'Rank';

  /// Header for the repo column on the dashboard.
  static const dashboardRepo = 'Repo';

  /// Header for the stars column on the dashboard.
  static const dashboardStars = 'Stars';

  /// Header for one day change columns.
  static const dashboardOneDay = '1-day';

  /// Header for seven day change columns.
  static const dashboardSevenDay = '7-day';

  /// Header for twenty eight day change columns.
  static const dashboardTwentyEightDay = '28-day';

  /// Tooltip for one day change headers.
  static const dashboardOneDayTooltip = 'Change in the last day';

  /// Tooltip for seven day change headers.
  static const dashboardSevenDayTooltip = 'Change in the last 7 days';

  /// Tooltip for twenty eight day change headers.
  static const dashboardTwentyEightDayTooltip = 'Change in the last 28 days';

  /// Footer text on the dashboard
  static dashboardFooter(String date) => 'Source: GitHub, $date. '
      'Excludes content-only repos (includes only software repos).';

  /// The link to the GitHub repo in the dashboard footer.
  static const dashboardFooterLink =
      'https://github.com/creativecreatorormaybenot/github-tracker';

  /// Message that is displayed while initially loading data in the dashboard.
  static const dashboardLoadingData = 'Loading data...';

  /// Hint that is displayed instead of a value on the dashboard when there is
  /// no value available (yet).
  static const dashboardValueNoData = 'N/A';

  // ------------------------------ Auth barrier -------------------------------

  /// Message that is displayed while showing the auth barrier.
  static const authBarrierMessage = 'Securing session...';

  // -------------------------- Twitter follow button --------------------------

  /// Button label for Twitter follow buttons.
  static String twitterFollowButtonLabel(String username) =>
      'Follow @$username';

  // ------------------------------- Error code --------------------------------

  /// Error code message for an error that has occurred.
  static errorCodeError(String errorCode) => 'error: $errorCode';

  /// Call to action to file an issue when an error code is shown.
  static const errorCodeFileIssue = 'please find or file an issue on GitHub (:';
}
