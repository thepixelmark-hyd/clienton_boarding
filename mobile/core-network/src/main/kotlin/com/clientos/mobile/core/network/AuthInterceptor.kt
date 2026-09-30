package com.clientos.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Attaches `Authorization: Bearer <token>` to every request when a token is
 * stored — the mobile-side half of the dual cookie/bearer auth described in
 * apps/api/src/common/guards/session-auth.guard.ts. Unlike the web client,
 * mobile never relies on a cookie jar (see docs/architecture-assessment.md
 * §4 for why), so this header is the *only* thing that authenticates a
 * request once logged in.
 */
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.current
        val request = if (token != null) {
            chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
