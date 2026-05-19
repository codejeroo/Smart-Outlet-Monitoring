#include <WiFi.h>
#include <HTTPClient.h>
#include <PZEM004Tv30.h>
#include <WebServer.h> // Include WebServer library

// --- WiFi Credentials ---
const char* ssid = "Angelo";
const char* password = "raprap123";

// --- Server Endpoint ---
const char* serverName = "http://172.20.10.6:8080/api/plugs/1/data";

#define RXD2 25
#define TXD2 26
#define RELAY_PIN 18 

PZEM004Tv30 pzem(Serial2, RXD2, TXD2);

// Initialize the web server on port 80
WebServer server(80);

// --- Non-blocking timer variables ---
unsigned long previousMillis = 0;
const long interval = 2000; // 2000 ms (2 seconds) delay between readings

// --- Web Server Handler Function ---
void handleRelay() {
  // Check if the POST request has a body
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    Serial.println("Received POST body: " + body);

    // Simple string parsing to check for true/on or false/off
    // Assuming a payload like {"state": true} or {"state": false}
    if (body.indexOf("true") > 0 || body.indexOf("\"on\"") > 0 || body.indexOf("\"ON\"") > 0) {
      
      // TURN ON APPLIANCE: Keep relay inactive so NC is CLOSED
      digitalWrite(RELAY_PIN, HIGH); 
      server.send(200, "application/json", "{\"status\":\"Success\", \"message\":\"Relay is HIGH (Appliance ON)\"}");
      Serial.println("Command executed: Relay set to HIGH");
      
    } else if (body.indexOf("false") > 0 || body.indexOf("\"off\"") > 0 || body.indexOf("\"OFF\"") > 0) {
      
      // TURN OFF APPLIANCE: Trigger relay so NC OPENS
      digitalWrite(RELAY_PIN, LOW); 
      server.send(200, "application/json", "{\"status\":\"Success\", \"message\":\"Relay is LOW (Appliance OFF)\"}");
      Serial.println("Command executed: Relay set to LOW");
      
    } else {
      server.send(400, "application/json", "{\"status\":\"Error\", \"message\":\"Invalid payload. Send true or false.\"}");
    }
  } else {
    server.send(400, "application/json", "{\"status\":\"Error\", \"message\":\"Body required in POST request.\"}");
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize the relay pin
  pinMode(RELAY_PIN, OUTPUT);
  
  // Most 5V relay modules are Active-LOW. 
  // Writing HIGH keeps the relay inactive, meaning the 
  // Normally Closed (NC) circuit remains CLOSED (power is flowing).
  digitalWrite(RELAY_PIN, HIGH); 

  // Connect to WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  
  // Print ESP32 IP Address (You need this to send POST requests TO the ESP32)
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  // --- Configure Web Server Routes ---
  // When a POST request hits http://[ESP32_IP]/relay, execute handleRelay()
  server.on("/relay", HTTP_POST, handleRelay);
  
  // Start the server
  server.begin();
  Serial.println("HTTP server started!");
  Serial.println("PZEM-004T RMS Data Reading...");
}

void loop() {
  // 1. Constantly handle incoming web server requests
  server.handleClient();

  // 2. Non-blocking timer for reading PZEM and sending data
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis; // Reset timer

    float Vrms = pzem.voltage();   // Already RMS
    float Irms = pzem.current();   // Already RMS
    float Power = pzem.power();    // Real power (W)
    float Energy = pzem.energy();  // kWh
    float Frequency = pzem.frequency();
    float PF = pzem.pf();

    if (isnan(Vrms) || isnan(Irms)) {
      Serial.println("Warning: PZEM returned NaN (Likely relay is OFF/Appliance Unpowered). Sending default zeros...");
      Vrms = 0.0;
      Irms = 0.0;
      Power = 0.0;
      PF = 0.0;
    } else {
      // Print to Serial Monitor
      Serial.print("Vrms: "); Serial.print(Vrms); Serial.println(" V");
      Serial.print("Irms: "); Serial.print(Irms); Serial.println(" A");
      Serial.print("Power: "); Serial.print(Power); Serial.println(" W");
    }
    
    // --- IDLE DETECTION LOGIC ---
    bool idleDetection = (Power < 5.0);

    // --- HTTP POST REQUEST (Always send data to the server as a heartbeat) ---
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      
      http.begin(serverName);
      http.addHeader("Content-Type", "application/json");

      String jsonPayload = "{";
      jsonPayload += "\"vrms\": " + String(Vrms, 1) + ",";
      jsonPayload += "\"irms\": " + String(Irms, 2) + ",";
      jsonPayload += "\"realPower\": " + String(Power, 1) + ",";
      jsonPayload += "\"powerFactor\": " + String(isnan(PF) ? 0.00 : PF, 2) + ",";
      jsonPayload += "\"idleDetection\": " + String(idleDetection ? "true" : "false");
      jsonPayload += "}";

      Serial.print("Sending Payload: ");
      Serial.println(jsonPayload);

      int httpResponseCode = http.POST(jsonPayload);

      if (httpResponseCode > 0) {
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("HTTP Error code: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
    } else {
      Serial.println("Error: WiFi Disconnected. Cannot send data.");
    }
    Serial.println("---------------------------");
  }
}