/*
 * HaptiGuide ESP32 telemetry -> Flask POST /api/telemetry
 *
 * Sends JSON: {"distance_cm": float|null, "obstacle": bool, "wifi_ip": "x.x.x.x"}
 * "battery" is intentionally omitted until a calibrated voltage circuit exists
 * (the server and dashboard treat a missing battery as unknown).
 *
 * Wiring (HC-SR04):
 *   VCC  -> 5V (VIN)       GND -> GND
 *   TRIG -> GPIO 5
 *   ECHO -> GPIO 18  THROUGH A VOLTAGE DIVIDER (e.g. 1k + 2k) -> ESP32 is 3.3 V only.
 *
 * Library: ArduinoJson v7 (Library Manager). Board: any ESP32 Dev Module.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- EDIT THESE ----
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// Online (Render etc.):  "https://YOUR-APP.onrender.com/api/telemetry"
// Local PC test:         "http://192.168.1.10:5000/api/telemetry"
const char* SERVER_URL    = "https://YOUR-APP.onrender.com/api/telemetry";
// Must match TELEMETRY_API_KEY set on the server (leave "" for local testing without a key).
const char* API_KEY       = "PASTE_YOUR_TELEMETRY_API_KEY";

// ---- Pins / tuning ----
const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const float OBSTACLE_CM = 100.0;        // closer than this => obstacle = true
const unsigned long SEND_INTERVAL_MS = 1000;   // server marks offline after 5 s, so keep well under that
const unsigned long WIFI_RETRY_MS    = 10000;

unsigned long lastSend = 0;
unsigned long lastWifiTry = 0;

// One HC-SR04 reading in cm, or -1 if no echo (out of range / wiring fault).
float readOnceCm() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL);   // 30 ms ~ 5 m max
  if (us == 0) return -1;
  return us * 0.0343f / 2.0f;
}

// Median of 3 to reject single spurious readings.
float readDistanceCm() {
  float v[3];
  for (int i = 0; i < 3; i++) { v[i] = readOnceCm(); delay(20); }
  for (int i = 0; i < 2; i++)
    for (int j = i + 1; j < 3; j++)
      if (v[j] < v[i]) { float t = v[i]; v[i] = v[j]; v[j] = t; }
  return v[1];
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiTry < WIFI_RETRY_MS && lastWifiTry != 0) return;
  lastWifiTry = millis();
  Serial.println("Connecting to Wi-Fi...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  float d = readDistanceCm();
  bool valid = d > 0;

  JsonDocument doc;
  if (valid) doc["distance_cm"] = round(d * 10) / 10.0;   // else field omitted => server stores null
  doc["obstacle"] = valid && d < OBSTACLE_CM;              // must be a real boolean
  doc["wifi_ip"]  = WiFi.localIP().toString();

  String body;
  serializeJson(doc, body);

  WiFiClientSecure secureClient;
  secureClient.setInsecure();   // encrypts traffic but does not verify the server certificate (prototype)
  HTTPClient http;
  http.setTimeout(8000);        // free hosts can take several seconds to wake up
  bool https = String(SERVER_URL).startsWith("https://");
  bool began = https ? http.begin(secureClient, SERVER_URL) : http.begin(SERVER_URL);
  if (began) {
    http.addHeader("Content-Type", "application/json");
    if (strlen(API_KEY) > 0) http.addHeader("X-API-Key", API_KEY);
    int code = http.POST(body);
    Serial.printf("POST %s -> %d\n", body.c_str(), code);
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  connectWifi();
}

void loop() {
  connectWifi();
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendTelemetry();
  }
}
