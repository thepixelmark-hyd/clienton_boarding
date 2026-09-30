package com.clientos.mobile.data

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

sealed class BiometricAvailability {
    data object Available : BiometricAvailability()
    /** No enrolled biometrics, no hardware, or disabled by policy — the app
     * falls back to the token already being enough (it was itself unlocked
     * by a password at login/signup time), not a hard failure. */
    data object Unavailable : BiometricAvailability()
}

/**
 * Gates app launch behind the device's biometric prompt when a session
 * already exists, so a stored token isn't usable by anyone who just picks
 * up the unlocked phone. This is additive to, not a replacement for, the
 * server-side session — a stolen/expired token still fails at the API
 * regardless of what happens on-device.
 */
class BiometricAuthManager(private val activity: FragmentActivity) {

    fun availability(): BiometricAvailability {
        val manager = BiometricManager.from(activity)
        val canAuthenticate = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
        return if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
            BiometricAvailability.Available
        } else {
            BiometricAvailability.Unavailable
        }
    }

    suspend fun authenticate(): Boolean = suspendCancellableCoroutine { continuation ->
        val executor = androidx.core.content.ContextCompat.getMainExecutor(activity)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                if (continuation.isActive) continuation.resume(true)
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                if (continuation.isActive) continuation.resume(false)
            }
            override fun onAuthenticationFailed() {
                // A single failed attempt (bad fingerprint read) — the
                // prompt stays open for another try, so this isn't resolved
                // here, only a final error or success is.
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock ClientOS")
            .setSubtitle("Confirm it's you to continue")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .setNegativeButtonText("Use password instead")
            .build()

        prompt.authenticate(promptInfo)
    }
}
