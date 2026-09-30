package com.clientos.mobile.core.network

import com.clientos.mobile.core.network.dto.LoginRequest
import com.clientos.mobile.core.network.dto.LoginResponse
import com.clientos.mobile.core.network.dto.MeResponse
import com.clientos.mobile.core.network.dto.SignupRequest
import com.clientos.mobile.core.network.dto.SignupResponse

interface AuthRepository {
    suspend fun signup(organizationName: String, fullName: String, email: String, password: String): ApiResult<SignupResponse>
    suspend fun login(email: String, password: String): ApiResult<LoginResponse>
    suspend fun logout(): ApiResult<Unit>
    suspend fun me(): ApiResult<MeResponse>
    /** True if a token is currently stored — enough to decide whether to show
     * the biometric-gated unlock screen or the login screen at app launch. */
    fun hasStoredSession(): Boolean
}

class AuthRepositoryImpl(
    private val api: AuthApi,
    private val tokenStore: TokenStore,
    private val json: kotlinx.serialization.json.Json = NetworkFactory.json,
) : AuthRepository {

    override suspend fun signup(
        organizationName: String,
        fullName: String,
        email: String,
        password: String,
    ): ApiResult<SignupResponse> {
        val result = safeApiCall(json) { api.signup(SignupRequest(organizationName, fullName, email, password)) }
        if (result is ApiResult.Success) {
            tokenStore.save(result.data.session.token, result.data.session.expiresAt)
        }
        return result
    }

    override suspend fun login(email: String, password: String): ApiResult<LoginResponse> {
        val result = safeApiCall(json) { api.login(LoginRequest(email, password)) }
        if (result is ApiResult.Success) {
            tokenStore.save(result.data.session.token, result.data.session.expiresAt)
        }
        return result
    }

    override suspend fun logout(): ApiResult<Unit> {
        val result = safeApiCall(json) { api.logout() }
        // Clear the local token regardless of whether the server call
        // succeeded — an expired/already-revoked session shouldn't leave the
        // user stuck unable to log out on this device.
        tokenStore.clear()
        return result
    }

    override suspend fun me(): ApiResult<MeResponse> = safeApiCall(json) { api.me() }

    override fun hasStoredSession(): Boolean = tokenStore.current != null
}
