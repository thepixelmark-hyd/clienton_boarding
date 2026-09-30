package com.clientos.mobile.core.network

import com.clientos.mobile.core.network.dto.ApiErrorBody
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import retrofit2.Response
import java.io.IOException

/**
 * Every AuthApi call goes through this so call sites never touch a raw
 * Retrofit `Response` or catch exceptions themselves — one place decides
 * how "the server said no" (parse the real ApiErrorBody, docs/api.md) is
 * different from "we never reached the server" (IOException), matching the
 * two failure modes `apps/web/src/lib/api-client.ts` already distinguishes.
 */
suspend fun <T> safeApiCall(json: Json, call: suspend () -> Response<T>): ApiResult<T> {
    return try {
        val response = call()
        val body = response.body()
        if (response.isSuccessful) {
            // A 2xx with no body (e.g. logout's Response<Unit>) is still success.
            @Suppress("UNCHECKED_CAST")
            ApiResult.Success(body ?: Unit as T)
        } else {
            val errorBody = response.errorBody()?.string()
            val parsed = errorBody?.let {
                try {
                    json.decodeFromString(ApiErrorBody.serializer(), it)
                } catch (_: SerializationException) {
                    null
                }
            }
            ApiResult.Error(
                code = parsed?.code ?: "UNKNOWN_ERROR",
                message = parsed?.message ?: "Something went wrong. Try again.",
                statusCode = response.code(),
            )
        }
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    }
}
