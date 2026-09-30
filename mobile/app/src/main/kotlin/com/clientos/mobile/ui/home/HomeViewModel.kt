package com.clientos.mobile.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clientos.mobile.core.network.ApiResult
import com.clientos.mobile.core.network.AuthRepository
import com.clientos.mobile.core.network.dto.MeResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class HomeUiState {
    data object Loading : HomeUiState()
    data class Loaded(val me: MeResponse) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        _uiState.update { HomeUiState.Loading }
        viewModelScope.launch {
            when (val result = authRepository.me()) {
                is ApiResult.Success -> _uiState.update { HomeUiState.Loaded(result.data) }
                is ApiResult.Error -> _uiState.update { HomeUiState.Error(result.message) }
                is ApiResult.NetworkError -> _uiState.update {
                    HomeUiState.Error("Couldn't reach the server. Check your connection and try again.")
                }
            }
        }
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout() // token is cleared locally regardless of the result — see AuthRepositoryImpl
            onLoggedOut()
        }
    }
}
