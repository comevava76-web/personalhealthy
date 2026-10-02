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

    // Release signing is supplied only through CI secrets. Debug uses Android's separate debug key.
    val ksFile = System.getenv("HINT_KEYSTORE_FILE").orEmpty()
    // Only tasks that build a release package need the key: not "dependencies --configuration releaseRuntimeClasspath",
    // which the nightly vulnerability scan runs without secrets (problem P-004).
    val releaseRequested = gradle.startParameter.taskNames.any { arg ->
        !arg.startsWith("-") && arg.substringAfterLast(':').let { t -> listOf("assemble", "bundle", "package", "sign").any { t.startsWith(it) } && t.contains("Release") }
    }
    if (releaseRequested) {
        require(ksFile.isNotBlank() && file(ksFile).exists()) { "Release signing key is required; no repository fallback" }
        require(!System.getenv("ANDROID_KEYSTORE_PASSWORD").isNullOrBlank() && !System.getenv("ANDROID_KEY_PASSWORD").isNullOrBlank()) { "Release signing passwords are required" }
    }
    signingConfigs {
        create("releasePrivate") {
            if (ksFile.isNotBlank()) {
                storeFile = file(ksFile)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS").orEmpty().ifBlank { "hint365" }
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("releasePrivate")
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
    testImplementation("junit:junit:4.13.2")
    // Bundled recognizer: no document upload and no runtime model download.
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    // pdfbox-android pulls in Bouncy Castle 1.72, which has known vulnerabilities (GHSA-574f-3g2m-x479 and others,
    // issue #126): the same libraries at a fixed version, same API
    constraints {
        listOf("bcprov", "bcpkix", "bcutil").forEach { m ->
            implementation("org.bouncycastle:$m-jdk15to18:1.86") { because("Bouncy Castle 1.72 advisories, fixed by 1.85+") }
        }
    }
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    implementation("androidx.exifinterface:exifinterface:1.4.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
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
    implementation("com.google.zxing:core:3.5.4")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
