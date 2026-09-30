package com.clientos.mobile.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * These are not independently chosen — they're the exact same semantic
 * tokens as apps/web/src/styles/tokens.css, converted from that file's HSL
 * values to RGB (see the conversion this was generated with). One brand,
 * one set of colors, two platforms — a color changed on web and not here
 * would be a real inconsistency bug, not just a style preference.
 */

// Light
val LightBackground = Color(0xFFFBFAF9)
val LightSurface = Color(0xFFFFFFFF)
val LightSurfaceSecondary = Color(0xFFF4F3F1)
val LightBorder = Color(0xFFE3E1DD)
val LightBorderStrong = Color(0xFFC7C2BD)
val LightTextPrimary = Color(0xFF181D25)
val LightTextSecondary = Color(0xFF535965)
val LightTextMuted = Color(0xFF838995)
val LightAccent = Color(0xFF1F4189)
val LightAccentForeground = Color(0xFFFFFFFF)
val LightSuccess = Color(0xFF227741)
val LightWarning = Color(0xFFC2720A)
val LightDanger = Color(0xFFC12F25)
val LightInfo = Color(0xFF2278A0)

// Dark — authored separately from light, not a mechanical invert (matches
// docs/design-system.md).
val DarkBackground = Color(0xFF101319)
val DarkSurface = Color(0xFF191C24)
val DarkSurfaceSecondary = Color(0xFF23262F)
val DarkBorder = Color(0xFF31353F)
val DarkBorderStrong = Color(0xFF454954)
val DarkTextPrimary = Color(0xFFF2F5F7)
val DarkTextSecondary = Color(0xFFB5BDC5)
val DarkTextMuted = Color(0xFF808993)
val DarkAccent = Color(0xFF689DF3)
val DarkAccentForeground = Color(0xFF121621)
val DarkSuccess = Color(0xFF4EBC76)
val DarkWarning = Color(0xFFEFAC39)
val DarkDanger = Color(0xFFE46258)
val DarkInfo = Color(0xFF52B3E0)
