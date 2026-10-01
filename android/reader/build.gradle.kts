// The photo reader of the blood-pressure monitor: plain Kotlin, no Android types, so its test can draw hundreds of
// monitor photos with the computer's graphics (java.awt), which the Android unit tests do not have.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    systemProperty("java.awt.headless", "true")
    // the env variables of the optional tests (real photos, debugging) pass through as they are
    testLogging { events("failed"); showStandardStreams = false }
}

// CI runs "gradle testDebugUnitTest": the reader's tests run with the app's
tasks.register("testDebugUnitTest") { dependsOn("test") }
