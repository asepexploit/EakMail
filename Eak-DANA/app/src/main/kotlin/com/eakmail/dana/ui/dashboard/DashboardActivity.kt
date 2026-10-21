package com.eakmail.dana.ui.dashboard

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.Menu
import android.view.MenuItem
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.eakmail.dana.R
import com.eakmail.dana.databinding.ActivityDashboardBinding
import com.eakmail.dana.ui.logs.LogsActivity
import com.eakmail.dana.ui.settings.SettingsActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@AndroidEntryPoint
class DashboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDashboardBinding
    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        setupClickListeners()
        observeUiState()
    }

    override fun onResume() {
        super.onResume()
        viewModel.refresh()
    }

    private fun setupClickListeners() {
        binding.btnGrantNotification.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        binding.btnTestConnection.setOnClickListener {
            viewModel.testConnection()
        }

        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        binding.btnLogs.setOnClickListener {
            startActivity(Intent(this, LogsActivity::class.java))
        }
    }

    private fun observeUiState() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    renderState(state)
                }
            }
        }
    }

    private fun renderState(state: DashboardUiState) {
        // Notification access
        binding.cardNotificationAccess.setCardBackgroundColor(
            getColor(if (state.hasNotificationAccess) R.color.status_ok else R.color.status_warn)
        )
        binding.tvNotificationStatus.text = if (state.hasNotificationAccess)
            "Akses Notifikasi: Aktif" else "Akses Notifikasi: Belum Diberikan"
        binding.btnGrantNotification.isVisible = !state.hasNotificationAccess

        // Config status
        binding.tvConfigStatus.text = if (state.isConfigured)
            "Konfigurasi: Terpasang" else "Konfigurasi: Belum Diatur"

        // Connection status
        val connText = when (state.connectionStatus) {
            ConnectionStatus.OK -> "VPS: Terhubung"
            ConnectionStatus.ERROR -> "VPS: Error — ${state.errorMessage}"
            ConnectionStatus.CHECKING -> "VPS: Memeriksa..."
            ConnectionStatus.UNKNOWN -> "VPS: Belum Diuji"
        }
        binding.tvConnectionStatus.text = connText
        binding.btnTestConnection.isEnabled = !state.isTestingConnection

        // Queue stats
        binding.tvPendingCount.text = "Antrian: ${state.pendingCount} event belum terkirim"

        // Server stats
        state.serverStatus?.let { s ->
            binding.tvServerStats.text = "Hari ini: ${s.total_events_today} event | Terakhir: ${s.last_event_at ?: "—"}"
            binding.tvServerStats.isVisible = true
        } ?: run {
            binding.tvServerStats.isVisible = false
        }

        // Recent events list (simple text for now)
        val eventsText = state.recentEvents.take(10).joinToString("\n") { e ->
            val time = SimpleDateFormat("HH:mm:ss", Locale("id")).format(Date(e.createdAt))
            val amount = e.parsedAmount?.let { "Rp${formatAmount(it)}" } ?: "?"
            "[$time] $amount — ${e.syncStatus}"
        }
        binding.tvRecentEvents.text = eventsText.ifBlank { "Belum ada event" }
    }

    private fun formatAmount(amount: Long): String =
        String.format(Locale("id"), "%,d", amount).replace(',', '.')

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_dashboard, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
