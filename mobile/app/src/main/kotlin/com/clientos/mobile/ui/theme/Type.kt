package com.clientos.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * The same type scale as apps/web/tailwind.config.ts (xs/sm/base/lg/xl/2xl),
 * mapped onto Compose's named slots. Uses the platform default sans-serif
 * rather than Inter: bundling Inter needs either shipping font files or
 * Android's downloadable-fonts provider (fonts.gstatic.com), and this
 * foundation was built in a sandbox whose network policy blocks Google's
 * font/asset hosts the same way it blocks dl.google.com (see
 * docs/architecture-assessment.md). This is a real, working type scale —
 * swapping in Inter later is a font-resource change to this one file, not
 * a design decision anything else in the app depends on.
 */
private val ClientOsFontFamily = FontFamily.SansSerif

val ClientOsTypography = Typography(
    bodySmall = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp),
    bodyMedium = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 22.sp),
    titleLarge = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 26.sp),
    headlineSmall = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp),
    labelLarge = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = ClientOsFontFamily, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
)
