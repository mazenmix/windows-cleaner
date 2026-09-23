plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val mxKeystorePath = System.getenv("MX_KEYSTORE_PATH")
val mxKeystorePassword = System.getenv("MX_KEYSTORE_PASSWORD")
val mxKeyAlias = System.getenv("MX_KEY_ALIAS") ?: "mxtracker"
val mxKeyPassword = System.getenv("MX_KEY_PASSWORD")

android {
    namespace = "com.mazenmix.mxfieldtracker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mazenmix.mxfieldtracker"
        minSdk = 26
        targetSdk = 34
        versionCode = 6
        versionName = "1.3.0"
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("mxStable") {
            if (!mxKeystorePath.isNullOrBlank()) {
                storeFile = file(mxKeystorePath)
                storePassword = mxKeystorePassword
                keyAlias = mxKeyAlias
                keyPassword = mxKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("mxStable")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core:1.13.1")
}
