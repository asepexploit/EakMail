package com.eakmail.dana.ui.logs

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.eakmail.dana.data.local.DanaEventDao
import com.eakmail.dana.databinding.ActivityLogsBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class LogsActivity : AppCompatActivity() {

    @Inject lateinit var danaEventDao: DanaEventDao

    private lateinit var binding: ActivityLogsBinding
    private val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale("id"))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLogsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = "Log Aktivitas"

        observeLogs()
    }

    private fun observeLogs() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                danaEventDao.observeRecent(200).collectLatest { events ->
                    val sb = StringBuilder()
                    events.forEach { e ->
                        val time = fmt.format(Date(e.createdAt))
                        val amount = e.parsedAmount?.let { "Rp${formatAmount(it)}" } ?: "nominal tidak terdeteksi"
                        val sync = when (e.syncStatus) {
                            "SYNCED" -> "✓ Terkirim"
                            "FAILED" -> "✗ Gagal (${e.retryCount}x)"
                            else -> "⏳ Menunggu (${e.retryCount}x)"
                        }
                        val server = e.serverStatus?.let { " → $it" } ?: ""
                        sb.appendLine("[$time]")
                        sb.appendLine("  $amount — ${e.rawTitle}")
                        sb.appendLine("  $sync$server")
                        sb.appendLine()
                    }
                    binding.tvLogs.text = if (sb.isEmpty()) "Belum ada log" else sb.toString()
                }
            }
        }
    }

    private fun formatAmount(amount: Long): String =
        String.format(Locale("id"), "%,d", amount).replace(',', '.')

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
