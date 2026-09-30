package com.clientos.mobile.core.network

/**
 * Persisting the token is inherently an Android concern (DataStore +
 * EncryptedSharedPreferences/Keystore, gated behind biometric unlock — see
 * :app's `data/DataStoreTokenStore.kt`), so it can't live in this pure-JVM
 * module. What *can* live here is the interface every other piece of
 * networking code depends on, so `:core-network` never needs to know
 * Android exists, and tests can swap in `InMemoryTokenStore` below instead
 * of standing up a real DataStore.
 *
 * `current` is synchronous and cached because `AuthInterceptor` (an OkHttp
 * interceptor) runs on an OkHttp dispatcher thread and cannot suspend to
 * read a DataStore Flow — this is a standard, accepted trade-off: the
 * *source of truth* is still the persisted store; `current` is a
 * read-through cache of it that `save`/`clear` keep in sync.
 */
interface TokenStore {
    val current: String?
    suspend fun save(token: String, expiresAt: String)
    suspend fun clear()
}

/** Used by tests, and available to any caller that doesn't need real
 * persistence (e.g. a short-lived process). Not used by the real app. */
class InMemoryTokenStore : TokenStore {
    @Volatile
    override var current: String? = null
        private set

    override suspend fun save(token: String, expiresAt: String) {
        current = token
    }

    override suspend fun clear() {
        current = null
    }
}
