// Intentionally empty. Each module declares its own plugins with explicit
// versions in its own build.gradle.kts, rather than this file declaring
// them once with `apply false` for subprojects to reuse un-versioned.
//
// That root-aggregator pattern is common, but it has a real cost in this
// repo: Gradle resolves every plugin named in the ROOT project's `plugins{}`
// block during the configuration phase for *any* invocation, regardless of
// which module you're actually building — so a root-level `apply false`
// declaration of the Android Gradle Plugin would force resolving it (from
// Google's Maven, dl.google.com) even when running a task that only
// touches :core-network, which has nothing to do with Android at all. Each
// module owning its own versions keeps :core-network buildable/testable
// with only a JDK and Maven Central (see :core-network's build.gradle.kts
// and docs/architecture-assessment.md §2), and costs nothing in a real
// Android Studio / CI environment where dl.google.com is reachable.
