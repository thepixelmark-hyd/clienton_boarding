package com.clientos.mobile.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.clientos.mobile.core.network.ApiResult
import com.clientos.mobile.core.network.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignupUiState(
    val organizationName: String = "",
    val fullName: String = "",
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class SignupViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SignupUiState())
    val uiState: StateFlow<SignupUiState> = _uiState.asStateFlow()

    fun onOrganizationNameChange(value: String) = update { it.copy(organizationName = value) }
    fun onFullNameChange(value: String) = update { it.copy(fullName = value) }
    fun onEmailChange(value: String) = update { it.copy(email = value) }
    fun onPasswordChange(value: String) = update { it.copy(password = value) }

    private inline fun update(transform: (SignupUiState) -> SignupUiState) {
        _uiState.update { transform(it).copy(errorMessage = null) }
    }

    fun signup(onSuccess: () -> Unit) {
        val state = _uiState.value
        if (state.organizationName.isBlank() || state.fullName.isBlank() || state.email.isBlank() || state.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "All fields are required.") }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        viewModelScope.launch {
            val result = authRepository.signup(
                organizationName = state.organizationName.trim(),
                fullName = state.fullName.trim(),
                email = state.email.trim(),
                password = state.password,
            )
            when (result) {
                is ApiResult.Success -> {
                    _uiState.update { it.copy(isLoading = false) }
                    onSuccess()
                }
                is ApiResult.Error -> _uiState.update { it.copy(isLoading = false, errorMessage = result.message) }
                is ApiResult.NetworkError -> _uiState.update {
                    it.copy(isLoading = false, errorMessage = "Couldn't reach the server. Check your connection and try again.")
                }
            }
        }
    }
}
