package com.clientos.mobile.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Every shape here mirrors a real response the NestJS API actually returns
 * today (apps/api/src/auth/auth.controller.ts) — not a guess at a future
 * contract. Kept in one file, one source of truth per field, the same
 * discipline `packages/shared` applies on the TypeScript side.
 */

@Serializable
data class SignupRequest(
    val organizationName: String,
    val fullName: String,
    val email: String,
    val password: String,
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class OrganizationDto(
    val id: String,
    val name: String,
    val slug: String,
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val fullName: String,
)

/** `token` is what the client sends back as `Authorization: Bearer <token>`
 * on every subsequent request — see SessionAuthGuard on the API side. */
@Serializable
data class SessionDto(
    val token: String,
    val expiresAt: String,
)

@Serializable
data class SignupResponse(
    val organization: OrganizationDto,
    val user: UserDto,
    val session: SessionDto,
)

@Serializable
data class LoginResponse(
    val user: UserDto,
    val session: SessionDto,
)

@Serializable
data class MembershipDto(
    val organizationId: String,
    val organizationName: String,
    val role: String,
)

@Serializable
data class MeResponse(
    val id: String,
    val email: String,
    val fullName: String,
    val memberships: List<MembershipDto>,
)

/** The API's consistent error envelope (docs/api.md) — `code` is the stable,
 * machine-readable string every screen switches on; `message` is always
 * safe to show a user verbatim. `details` is arbitrary (e.g. per-field
 * validation errors nested a level deep), so it's kept as raw JSON rather
 * than a fixed shape — callers that need it parse the specific keys they
 * expect. */
@Serializable
data class ApiErrorBody(
    val code: String,
    val message: String,
    val details: JsonElement? = null,
)
