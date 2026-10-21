package com.eakmail.dana.ui.dashboard

import android.content.Context
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.eakmail.dana.data.local.DanaEventEntity
import com.eakmail.dana.data.preferences.ConfigPreferences
import com.eakmail.dana.data.remote.DanaStatusResponse
import com.eakmail.dana.data.repository.DanaEventRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class DashboardUiState(
    val hasNotificationAccess: Boolean = false,
    val isConfigured: Boolean = false,
    val connectionStatus: ConnectionStatus = ConnectionStatus.UNKNOWN,
    val pendingCount: Int = 0,
    val recentEvents: List<DanaEventEntity> = emptyList(),
    val serverStatus: DanaStatusResponse? = null,
    val isTestingConnection: Boolean = false,
    val errorMessage: String? = null,
)

enum class ConnectionStatus { UNKNOWN, CHECKING, OK, ERROR }

@HiltViewModel
class DashboardViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: DanaEventRepository,
    private val configPreferences: ConfigPreferences,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        observeQueue()
        refresh()
        startHeartbeat()
    }

    private fun startHeartbeat() {
        viewModelScope.launch {
            while (isActive) {
                if (configPreferences.isConfigured()) {
                    try {
                        val response = withContext(Dispatchers.IO) { repository.fetchStatus() }
                        if (response?.isSuccessful == true) {
                            _uiState.update {
                                it.copy(connectionStatus = ConnectionStatus.OK, serverStatus = response.body())
                            }
                        }
                    } catch (_: Exception) { }
                }
                delay(30_000L)
            }
        }
    }

    private fun observeQueue() {
        viewModelScope.launch {
            repository.observeRecent(50).collect { events ->
                _uiState.update { it.copy(recentEvents = events) }
            }
        }
        viewModelScope.launch {
            repository.observePendingCount().collect { count ->
                _uiState.update { it.copy(pendingCount = count) }
            }
        }
    }

    fun refresh() {
        _uiState.update {
            it.copy(
                hasNotificationAccess = hasNotificationAccess(),
                isConfigured = configPreferences.isConfigured(),
            )
        }
    }

    fun testConnection() {
        if (!configPreferences.isConfigured()) return
        _uiState.update { it.copy(isTestingConnection = true, errorMessage = null, connectionStatus = ConnectionStatus.CHECKING) }

        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    repository.fetchStatus()
                }
                if (response == null) {
                    _uiState.update {
                        it.copy(connectionStatus = ConnectionStatus.ERROR, errorMessage = "Belum dikonfigurasi", isTestingConnection = false)
                    }
                    return@launch
                }
                if (response.isSuccessful) {
                    _uiState.update {
                        it.copy(connectionStatus = ConnectionStatus.OK, serverStatus = response.body(), isTestingConnection = false)
                    }
                } else {
                    _uiState.update {
                        it.copy(connectionStatus = ConnectionStatus.ERROR, errorMessage = "HTTP ${response.code()}", isTestingConnection = false)
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(connectionStatus = ConnectionStatus.ERROR, errorMessage = e.message ?: "Gagal terhubung", isTestingConnection = false)
                }
            }
        }
    }

    private fun hasNotificationAccess(): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        return flat.contains(context.packageName)
    }
}
