package com.clientos.mobile.core.network

/**
 * Mirrors the web client's `ApiClientError` design (apps/web/src/lib/api-client.ts)
 * so both clients handle the API's error envelope the same way: a typed
 * result instead of a thrown exception a UI layer has to remember to catch,
 * with the same three cases — success, a real API error (with the stable
 * `code` a screen can switch on), or "we never even reached the server."
 */
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: String, val message: String, val statusCode: Int) : ApiResult<Nothing>()
    /** DNS failure, no connectivity, timeout — never got an HTTP response at all. */
    data class NetworkError(val cause: Throwable) : ApiResult<Nothing>()
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(data))
    is ApiResult.Error -> this
    is ApiResult.NetworkError -> this
}
