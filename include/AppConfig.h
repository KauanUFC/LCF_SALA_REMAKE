#ifndef APPCONFIG_H
#define APPCONFIG_H

#include <cstdint>

// LED
static constexpr uint8_t LED_PIN = 8;
static constexpr bool LED_ACTIVE_LOW = false;

// WiFi
static constexpr uint32_t WIFI_TIMEOUT_MS = 10000;
static constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;

// MQTT (HiveMQ public broker)
static constexpr const char* MQTT_BROKER = "broker.hivemq.com";
// static constexpr const char* MQTT_BROKER = "<ip>"; // broker local Mosquitto
static constexpr uint16_t MQTT_PORT = 1883;
static constexpr uint32_t MQTT_RECONNECT_INTERVAL_MS = 5000;

// Telemetry
static constexpr uint32_t TELEMETRY_INTERVAL_MS = 5000;

// OTA
static constexpr uint16_t OTA_PORT = 8266;
static constexpr const char* OTA_PATH = "/update";

// HTTP
static constexpr uint16_t HTTP_PORT = 80;

#endif