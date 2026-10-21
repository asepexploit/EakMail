package com.eakmail.dana.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [DanaEventEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class EakDanaDatabase : RoomDatabase() {
    abstract fun danaEventDao(): DanaEventDao
}
