package com.clientos.mobile.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.clientos.mobile.ui.theme.ClientOsTheme

/**
 * The entire home surface this phase ships: proof that signup/login,
 * session persistence, and an authenticated GET all work end to end. Project
 * lists, tasks, requirements — everything the real PRD eventually wants
 * here — are explicitly out of scope for this phase (see
 * docs/architecture-assessment.md §20's phase plan); this screen is a
 * foundation to build those on, not a stand-in for them.
 */
@Composable
fun HomeScreen(
    onLoggedOut: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("ClientOS") }) },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            when (val current = state) {
                is HomeUiState.Loading -> CircularProgressIndicator()
                is HomeUiState.Error -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(current.message, style = MaterialTheme.typography.bodyMedium)
                    Button(onClick = viewModel::load, modifier = Modifier.padding(top = 12.dp)) {
                        Text("Try again")
                    }
                }
                is HomeUiState.Loaded -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(24.dp),
                ) {
                    Text("Welcome, ${current.me.fullName}", style = MaterialTheme.typography.headlineSmall)
                    val org = current.me.memberships.firstOrNull()
                    if (org != null) {
                        Text(
                            "${org.organizationName} · ${org.role.replace('_', ' ')}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = ClientOsTheme.extendedColors.textSecondary,
                        )
                    }
                    Button(
                        onClick = { viewModel.logout(onLoggedOut) },
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        Text("Sign out")
                    }
                }
            }
        }
    }
}
