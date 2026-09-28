plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val runNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1
val apiUrl = System.getenv("BATTITO_API_URL")?.takeIf { it.isNotBlank() } ?: "https://example.invalid"
// Google Cloud "Web client ID" for Sign in with Google (GitHub repository variable); empty = invite codes only
val googleClientId = System.getenv("GOOGLE_WEB_CLIENT_ID")?.trim() ?: ""

android {
    namespace = "ch.personalhealthy.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ch.personalhealthy.app"
        minSdk = 26
        targetSdk = 34
        versionCode = runNumber
        versionName = "0.1.$runNumber"
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
        buildConfigField("String", "GOOGLE_CLIENT_ID", "\"$googleClientId\"")
    }

    // Fixed signing key: every new version installs over the previous one without losing anything.
    // The key comes from the GitHub secrets (ANDROID_KEYSTORE_*, decoded by the workflow into HINT_KEYSTORE_FILE);
    // until the owner adds them, the old key in the repository is used.
    val ksFile = System.getenv("HINT_KEYSTORE_FILE").orEmpty()
    signingConfigs {
        create("family") {
            if (ksFile.isNotBlank() && file(ksFile).exists()) {
                storeFile = file(ksFile)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS").orEmpty().ifBlank { "hint365" }
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            } else {
                storeFile = file("personalhealthy.keystore")
                storePassword = "battito-family"
                keyAlias = "battito"
                keyPassword = "battito-family"
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("family")
        }
        getByName("debug") {
            signingConfig = signingConfigs.getByName("family")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    // app lock with the phone's fingerprint, face or screen lock
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.fragment:fragment-ktx:1.8.1") // recent FragmentActivity: works with the camera and QR launchers
    // Sign in with Google (Credential Manager): only to create the account and to recover it on a new phone
    // yearly subscription through Google Play
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    // QR codes for invites: drawing them (core) and scanning them with the camera (embedded scanner)
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
