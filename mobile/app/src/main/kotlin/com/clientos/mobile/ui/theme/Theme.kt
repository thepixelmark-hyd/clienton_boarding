package com.clientos.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Material3's ColorScheme only has slots for a handful of semantic roles
 * (primary, surface, error, ...). The web design system has more than that
 * — success/warning/info as distinct signals, a separate "muted" text tier,
 * a secondary surface, a stronger border — so this extends it rather than
 * squeezing everything into Material3's smaller vocabulary or losing
 * meaning by reusing `error` for anything red-ish.
 */
data class ClientOsExtendedColors(
    val surfaceSecondary: Color,
    val borderStrong: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
    val info: Color,
)

private val LocalExtendedColors = staticCompositionLocalOf {
    ClientOsExtendedColors(
        surfaceSecondary = LightSurfaceSecondary,
        borderStrong = LightBorderStrong,
        textSecondary = LightTextSecondary,
        textMuted = LightTextMuted,
        success = LightSuccess,
        warning = LightWarning,
        danger = LightDanger,
        info = LightInfo,
    )
}

/** Access the tokens Material3's ColorScheme doesn't have a slot for —
 * `ClientOsTheme.extendedColors.success`, alongside the standard
 * `MaterialTheme.colorScheme`/`MaterialTheme.typography`. */
object ClientOsTheme {
    val extendedColors: ClientOsExtendedColors
        @Composable get() = LocalExtendedColors.current
}

private val LightColors = lightColorScheme(
    background = LightBackground,
    surface = LightSurface,
    onBackground = LightTextPrimary,
    onSurface = LightTextPrimary,
    primary = LightAccent,
    onPrimary = LightAccentForeground,
    outline = LightBorder,
    error = LightDanger,
)

private val DarkColors = darkColorScheme(
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = DarkTextPrimary,
    onSurface = DarkTextPrimary,
    primary = DarkAccent,
    onPrimary = DarkAccentForeground,
    outline = DarkBorder,
    error = DarkDanger,
)

@Composable
fun ClientOSTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    val extended = if (darkTheme) {
        ClientOsExtendedColors(
            surfaceSecondary = DarkSurfaceSecondary,
            borderStrong = DarkBorderStrong,
            textSecondary = DarkTextSecondary,
            textMuted = DarkTextMuted,
            success = DarkSuccess,
            warning = DarkWarning,
            danger = DarkDanger,
            info = DarkInfo,
        )
    } else {
        ClientOsExtendedColors(
            surfaceSecondary = LightSurfaceSecondary,
            borderStrong = LightBorderStrong,
            textSecondary = LightTextSecondary,
            textMuted = LightTextMuted,
            success = LightSuccess,
            warning = LightWarning,
            danger = LightDanger,
            info = LightInfo,
        )
    }

    CompositionLocalProvider(LocalExtendedColors provides extended) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ClientOsTypography,
            content = content,
        )
    }
}
