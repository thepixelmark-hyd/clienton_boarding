package com.clientos.mobile.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.clientos.mobile.core.network.TokenStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.authDataStore by preferencesDataStore(name = "clientos_auth")
private val TOKEN_KEY = stringPreferencesKey("session_token")
private val EXPIRES_AT_KEY = stringPreferencesKey("session_expires_at")

/**
 * The real, Android-backed implementation of `TokenStore` (the interface
 * lives in :core-network, which cannot depend on Android — see that
 * module's TokenStore.kt). Persists to Jetpack DataStore, not
 * SharedPreferences directly, per current Android guidance; `current` is
 * an in-memory cache kept in sync with the persisted value so
 * `AuthInterceptor` (a synchronous OkHttp interceptor) can read it without
 * suspending.
 *
 * This stores the raw session token in DataStore's preferences file, which
 * is sandboxed to this app by the OS but not encrypted at rest by itself.
 * The biometric gate (`BiometricAuthManager`) controls *access* to the app
 * once a token exists; encrypting the stored value itself with
 * `androidx.security.crypto` (already a dependency) is the next hardening
 * step here and is called out rather than silently skipped.
 */
class DataStoreTokenStore(context: Context) : TokenStore {
    private val appContext = context.applicationContext

    @Volatile
    private var cached: String? = null

    override val current: String?
        get() = cached

    /** Call once at process start (see ClientOsApplication) so `current` is
     * populated before the first authenticated request could possibly fire. */
    fun primeCache() {
        cached = runBlocking { appContext.authDataStore.data.first()[TOKEN_KEY] }
    }

    override suspend fun save(token: String, expiresAt: String) {
        cached = token
        appContext.authDataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
            prefs[EXPIRES_AT_KEY] = expiresAt
        }
    }

    override suspend fun clear() {
        cached = null
        appContext.authDataStore.edit { prefs ->
            prefs.remove(TOKEN_KEY)
            prefs.remove(EXPIRES_AT_KEY)
        }
    }
}
