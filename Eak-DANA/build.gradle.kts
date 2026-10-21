buildscript {
    dependencies {
        // Force javapoet 1.13.0 to fix Hilt AggregateDepsTask NoSuchMethodError on JDK 17+
        classpath("com.squareup:javapoet:1.13.0")
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
}
