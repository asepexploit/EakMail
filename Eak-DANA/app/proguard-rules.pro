# EakDana ProGuard rules

# Retrofit + OkHttp
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# Gson — keep model classes
-keep class com.eakmail.dana.data.remote.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keepclassmembers class * extends androidx.room.RoomDatabase { *; }

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# WorkManager
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.CoroutineWorker
