package com.clientos.mobile.core.network

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

/**
 * Real HTTP round trips against a local MockWebServer — no Android SDK, no
 * mocking framework standing in for the network layer. These responses are
 * copied verbatim from what apps/api actually returns (verified by the
 * matching API e2e tests), so a change to the API's response shape that
 * this DTO set doesn't account for shows up here, not as a runtime crash
 * on a real device.
 */
class AuthRepositoryImplTest {
    private lateinit var server: MockWebServer
    private lateinit var tokenStore: InMemoryTokenStore
    private lateinit var repository: AuthRepositoryImpl

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
        tokenStore = InMemoryTokenStore()
        val client = NetworkFactory.createOkHttpClient(tokenStore, debugLogging = false)
        val api = NetworkFactory.createAuthApi(server.url("/").toString(), client)
        repository = AuthRepositoryImpl(api, tokenStore)
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `login success stores the token and returns the user`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(
                    """{"user":{"id":"u1","email":"alex@meridian.agency","fullName":"Alex Rivera"},"session":{"token":"opaque-token-value","expiresAt":"2026-01-01T00:00:00.000Z"}}""",
                ),
        )

        val result = repository.login("alex@meridian.agency", "DemoPass123")

        assertTrue(result is ApiResult.Success)
        result as ApiResult.Success
        assertEquals("alex@meridian.agency", result.data.user.email)
        assertEquals("opaque-token-value", tokenStore.current)
        assertTrue(repository.hasStoredSession())
    }

    @Test
    fun `login failure surfaces the real error code without storing a token`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody("""{"code":"INVALID_CREDENTIALS","message":"That email and password combination is not correct."}"""),
        )

        val result = repository.login("alex@meridian.agency", "WrongPassword")

        assertTrue(result is ApiResult.Error)
        result as ApiResult.Error
        assertEquals("INVALID_CREDENTIALS", result.code)
        assertEquals(401, result.statusCode)
        assertNull(tokenStore.current)
    }

    @Test
    fun `rate-limited login surfaces a 429 as a typed error, not a crash`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(429)
                .setBody("""{"code":"RATE_LIMITED","message":"Too many attempts. Wait a moment and try again."}"""),
        )

        val result = repository.login("alex@meridian.agency", "DemoPass123")

        assertTrue(result is ApiResult.Error)
        assertEquals(429, (result as ApiResult.Error).statusCode)
    }

    @Test
    fun `signup success stores the token`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(201)
                .setBody(
                    """{"organization":{"id":"o1","name":"Meridian Digital","slug":"meridian-digital"},"user":{"id":"u1","email":"alex@meridian.agency","fullName":"Alex Rivera"},"session":{"token":"fresh-token","expiresAt":"2026-01-01T00:00:00.000Z"}}""",
                ),
        )

        val result = repository.signup("Meridian Digital", "Alex Rivera", "alex@meridian.agency", "DemoPass123")

        assertTrue(result is ApiResult.Success)
        assertEquals("fresh-token", tokenStore.current)
    }

    @Test
    fun `a request that never reaches the server is a NetworkError, not a thrown exception`() = runTest {
        server.shutdown() // nothing is listening anymore

        val result = repository.login("alex@meridian.agency", "DemoPass123")

        assertTrue(result is ApiResult.NetworkError)
    }

    @Test
    fun `logout clears the local token even when the server call fails`() = runTest {
        tokenStore.save("some-token", "2026-01-01T00:00:00.000Z")
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"code":"UNAUTHENTICATED","message":"Session expired."}"""))

        repository.logout()

        assertNull(tokenStore.current)
    }

    @Test
    fun `me sends the stored token as a bearer header`() = runTest {
        tokenStore.save("bearer-abc", "2026-01-01T00:00:00.000Z")
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"id":"u1","email":"alex@meridian.agency","fullName":"Alex Rivera","memberships":[]}"""),
        )

        repository.me()

        val recorded = server.takeRequest()
        assertEquals("Bearer bearer-abc", recorded.getHeader("Authorization"))
    }
}
