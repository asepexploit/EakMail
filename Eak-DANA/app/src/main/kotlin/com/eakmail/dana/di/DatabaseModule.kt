package com.eakmail.dana.di

import android.content.Context
import androidx.room.Room
import com.eakmail.dana.data.local.DanaEventDao
import com.eakmail.dana.data.local.EakDanaDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Singleton
    @Provides
    fun provideDatabase(@ApplicationContext context: Context): EakDanaDatabase =
        Room.databaseBuilder(context, EakDanaDatabase::class.java, "eak_dana.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideDanaEventDao(db: EakDanaDatabase): DanaEventDao = db.danaEventDao()
}
