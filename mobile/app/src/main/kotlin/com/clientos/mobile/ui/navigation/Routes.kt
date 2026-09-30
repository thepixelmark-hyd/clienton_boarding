package com.clientos.mobile.ui.navigation

/** Every screen this foundation phase has. Deliberately just auth + a home
 * shell — see docs/architecture-assessment.md §4 and the instruction this
 * was built under: no project/CRM/requirements screens yet. */
object Routes {
    const val UNLOCK = "unlock"
    const val LOGIN = "login"
    const val SIGNUP = "signup"
    const val HOME = "home"
}
