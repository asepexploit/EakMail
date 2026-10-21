package com.eakmail.dana.data.preferences

import android.content.Context
import androidx.core.content.edit
import com.eakmail.dana.domain.model.DeviceConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConfigPreferences @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences("eak_dana_config", Context.MODE_PRIVATE)

    fun save(config: DeviceConfig) {
        prefs.edit {
            putString(KEY_BACKEND_URL, config.backendUrl)
            putString(KEY_DEVICE_TOKEN, config.deviceToken)
            putString(KEY_DEVICE_ID, config.deviceId)
            putInt(KEY_TIMEOUT, config.timeoutSeconds)
        }
    }

    fun load(): DeviceConfig? {
        val url = prefs.getString(KEY_BACKEND_URL, null) ?: return null
        val token = prefs.getString(KEY_DEVICE_TOKEN, null) ?: return null
        val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: return null
        return DeviceConfig(
            backendUrl = url,
            deviceToken = token,
            deviceId = deviceId,
            timeoutSeconds = prefs.getInt(KEY_TIMEOUT, 15),
        )
    }

    fun isConfigured(): Boolean = load() != null

    companion object {
        private const val KEY_BACKEND_URL = "backend_url"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_TIMEOUT = "timeout_seconds"
    }
}
