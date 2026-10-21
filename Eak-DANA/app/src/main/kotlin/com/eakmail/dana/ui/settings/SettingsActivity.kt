package com.eakmail.dana.ui.settings

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.eakmail.dana.data.preferences.ConfigPreferences
import com.eakmail.dana.databinding.ActivitySettingsBinding
import com.eakmail.dana.domain.model.DeviceConfig
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class SettingsActivity : AppCompatActivity() {

    @Inject lateinit var configPreferences: ConfigPreferences

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = "Pengaturan"

        loadCurrentConfig()

        binding.btnSave.setOnClickListener { saveConfig() }
    }

    private fun loadCurrentConfig() {
        val config = configPreferences.load() ?: return
        binding.etBackendUrl.setText(config.backendUrl)
        binding.etDeviceToken.setText(config.deviceToken)
        binding.etDeviceId.setText(config.deviceId)
        binding.etTimeout.setText(config.timeoutSeconds.toString())
    }

    private fun saveConfig() {
        val url = binding.etBackendUrl.text.toString().trim()
        val token = binding.etDeviceToken.text.toString().trim()
        val deviceId = binding.etDeviceId.text.toString().trim()
        val timeout = binding.etTimeout.text.toString().trim().toIntOrNull() ?: 15

        if (url.isBlank() || token.isBlank() || deviceId.isBlank()) {
            Toast.makeText(this, "URL, token, dan device ID wajib diisi", Toast.LENGTH_SHORT).show()
            return
        }

        configPreferences.save(
            DeviceConfig(
                backendUrl = url,
                deviceToken = token,
                deviceId = deviceId,
                timeoutSeconds = timeout,
            )
        )
        Toast.makeText(this, "Pengaturan disimpan", Toast.LENGTH_SHORT).show()
        finish()
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
