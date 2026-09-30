package com.clientos.mobile.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * The one place OkHttp/Retrofit get configured — call sites (Hilt modules in
 * :app, or a test) ask this for an `AuthApi`, they never build a
 * Retrofit instance by hand. `json` is exposed separately because
 * `safeApiCall` needs the exact same configured instance to decode error
 * bodies that Retrofit's success-path converter doesn't touch.
 */
object NetworkFactory {
    val json: Json = Json {
        ignoreUnknownKeys = true // the API can grow new response fields without breaking old app builds
        isLenient = true
    }

    fun createOkHttpClient(tokenStore: TokenStore, debugLogging: Boolean): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(tokenStore))
            .apply {
                if (debugLogging) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .build()
    }

    fun createAuthApi(baseUrl: String, client: OkHttpClient): AuthApi {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
            .create(AuthApi::class.java)
    }
}
