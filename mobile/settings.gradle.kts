pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "clientos-mobile"

// :core-network is pure Kotlin/JVM (no Android Gradle Plugin, no AndroidX) —
// it builds and tests with nothing but a JDK and Maven Central, which is
// exactly the split described in docs/architecture-assessment.md §2/§4: the
// business-logic-bearing code is verifiable in any environment, including
// one where the Android SDK / google() Maven repo isn't reachable; only
// :app (Compose UI, the Android manifest, Hilt-Android wiring) needs the
// full Android toolchain.
include(":core-network")
include(":app")
