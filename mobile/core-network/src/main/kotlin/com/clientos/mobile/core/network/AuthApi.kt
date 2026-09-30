package com.clientos.mobile.core.network

import com.clientos.mobile.core.network.dto.LoginRequest
import com.clientos.mobile.core.network.dto.LoginResponse
import com.clientos.mobile.core.network.dto.MeResponse
import com.clientos.mobile.core.network.dto.SignupRequest
import com.clientos.mobile.core.network.dto.SignupResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * One-to-one with apps/api/src/auth/auth.controller.ts's public surface —
 * only the endpoints the mobile foundation actually uses. `Response<T>`
 * (not a bare suspend return) is deliberate: Retrofit throws on a
 * non-2xx *only* when there's no way to read the body, but with a
 * `Response<T>` wrapper we get the status code and can read the error body
 * ourselves via the converter, which is what `safeApiCall` needs to turn a
 * 401 with a real `ApiErrorBody` into `ApiResult.Error`, not an exception.
 */
interface AuthApi {
    @POST("auth/signup")
    suspend fun signup(@Body body: SignupRequest): Response<SignupResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("auth/me")
    suspend fun me(): Response<MeResponse>
}
