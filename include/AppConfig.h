#ifndef APPCONFIG_H
#define APPCONFIG_H

#include <cstdint>

// CPU frequency (MHz). Sensible default; override at build time with
// -DCPU_FREQ_MHZ=80 (or 160) in platformio.ini build_flags.
#ifndef CPU_FREQ_MHZ
#define CPU_FREQ_MHZ 80
#endif
static constexpr uint8_t CpuFreqMhz = CPU_FREQ_MHZ;

// LED
static constexpr uint8_t LED_PIN = 8;
static constexpr bool LED_ACTIVE_LOW = false;

// WiFi
static constexpr uint32_t WIFI_TIMEOUT_MS = 10000;
static constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;

// MQTT (HiveMQ public broker)
static constexpr const char* MQTT_BROKER = "broker.hivemq.com";
// static constexpr const char* MQTT_BROKER = "192.168.100.194"; // broker local Mosquitto
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