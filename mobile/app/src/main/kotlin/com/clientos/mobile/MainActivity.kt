package com.clientos.mobile

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.clientos.mobile.core.network.AuthRepository
import com.clientos.mobile.data.BiometricAuthManager
import com.clientos.mobile.data.BiometricAvailability
import com.clientos.mobile.ui.navigation.ClientOsNavHost
import com.clientos.mobile.ui.navigation.Routes
import com.clientos.mobile.ui.theme.ClientOSTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

/**
 * FragmentActivity (not plain ComponentActivity) because androidx.biometric's
 * stable BiometricPrompt API requires it — see BiometricAuthManager.
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    @Inject lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ClientOSTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    AppGate(authRepository = authRepository, biometricManager = BiometricAuthManager(this))
                }
            }
        }
    }
}

private enum class GateState { CHECKING, NEEDS_UNLOCK, READY }

@Composable
private fun AppGate(authRepository: AuthRepository, biometricManager: BiometricAuthManager) {
    var gateState by remember { mutableStateOf(GateState.CHECKING) }
    var startDestination by remember { mutableStateOf(Routes.LOGIN) }

    LaunchedEffect(Unit) {
        val hasSession = authRepository.hasStoredSession()
        when {
            !hasSession -> {
                startDestination = Routes.LOGIN
                gateState = GateState.READY
            }
            biometricManager.availability() is BiometricAvailability.Available -> {
                gateState = GateState.NEEDS_UNLOCK
            }
            else -> {
                // A session exists but this device can't do biometrics
                // (no hardware, nothing enrolled) — the token itself is
                // still what authenticates every request; there's nothing
                // extra to gate with here.
                startDestination = Routes.HOME
                gateState = GateState.READY
            }
        }
    }

    when (gateState) {
        GateState.CHECKING -> Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            CircularProgressIndicator()
        }
        GateState.NEEDS_UNLOCK -> UnlockScreen(
            biometricManager = biometricManager,
            onUnlocked = {
                startDestination = Routes.HOME
                gateState = GateState.READY
            },
            onUseLoginInstead = {
                startDestination = Routes.LOGIN
                gateState = GateState.READY
            },
        )
        GateState.READY -> ClientOsNavHost(startDestination = startDestination)
    }
}

@Composable
private fun UnlockScreen(
    biometricManager: BiometricAuthManager,
    onUnlocked: () -> Unit,
    onUseLoginInstead: () -> Unit,
) {
    var triedOnce by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun attempt() {
        triedOnce = true
        if (biometricManager.authenticate()) onUnlocked()
    }

    LaunchedEffect(Unit) { attempt() }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("Unlock ClientOS", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Confirm it's you to continue.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp, bottom = 20.dp),
            )
            if (triedOnce) {
                Button(onClick = { scope.launch { attempt() } }) {
                    Text("Try again")
                }
                TextButton(
                    onClick = onUseLoginInstead,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Text("Use password instead")
                }
            }
        }
    }
}
