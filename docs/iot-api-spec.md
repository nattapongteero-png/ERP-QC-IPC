# IoT Environmental Sensor API Specification

**Version:** 1.0
**Last Updated:** 2026-04-10
**Audience:** IoT firmware/device developers

## Overview

Environmental sensors (temperature + humidity) report readings to the Herbal Medicine ERP via HTTP REST API. The ERP manages all business logic — which work orders are active, what phase each work order is in, what the environmental limits are, and when readings are needed. The IoT device only needs to know **its own room ID** and **the API key**.

---

## Authentication

All endpoints require the header:

```
X-API-Key: <your-api-key>
```

The API key is configured on the ERP side via the environment variable `EXTERNAL_ENV_API_KEY`. Contact the ERP administrator for the key for your environment.

---

## Device Configuration (per device)

Each IoT device must be configured with:

| Field | Description | Example |
|-------|-------------|---------|
| `roomId` | The ERP room ID where this device is installed | `3` |
| `apiKey` | The shared API key for authentication | `env-monitor-2026-secret` |
| `baseUrl` | ERP base URL | `https://herbal-erp-metaherb.bmscloud.in.th` |

---

## Endpoint 1: Poll — "Should I send now?"

```
GET /api/iot/should-send?roomId={roomId}
```

### Purpose

The device polls this endpoint at a short interval (default 10 seconds) to ask the ERP whether a new reading should be taken and sent. The ERP responds with instructions based on the current production state:

- **idle** — No active work order uses this room. Device should poll slowly.
- **normal** — Active work order; latest reading is within limits. Send periodically.
- **urgent** — Active work order; latest reading is missing, stale, or outside limits. Send immediately.

### Request

```http
GET /api/iot/should-send?roomId=3 HTTP/1.1
Host: herbal-erp-metaherb.bmscloud.in.th
X-API-Key: env-monitor-2026-secret
```

### Response

```json
{
  "success": true,
  "mode": "urgent",
  "sendNow": true,
  "pollInterval": 10,
  "sendInterval": 10,
  "reason": "Latest reading outside limits — waiting for environment to stabilize",
  "workOrder": {
    "id": 123,
    "woNumber": "WO-2026-001",
    "phase": "production"
  },
  "limits": {
    "temperatureMin": 20,
    "temperatureMax": 24,
    "humidityMax": 55
  },
  "latestReading": {
    "temperature": 27.3,
    "humidity": 68,
    "isNormal": false,
    "recordedAt": "2026-04-10T14:25:00.000Z"
  },
  "timestamp": "2026-04-10T14:30:05.000Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"idle" \| "normal" \| "urgent"` | Operating mode the device should use |
| `sendNow` | `boolean` | If `true`, take a reading and send immediately |
| `pollInterval` | `number` | How often to poll this endpoint, in **seconds** |
| `sendInterval` | `number \| null` | How often to send readings in this mode, in **seconds** |
| `reason` | `string` | Human-readable explanation (for logs) |
| `workOrder` | `object \| null` | Active work order info, or `null` if idle |
| `limits` | `object \| null` | BOM environmental limits for the current phase |
| `latestReading` | `object \| null` | Most recent reading recorded by the ERP |
| `timestamp` | `ISO-8601` | Server time when response was generated |

### Mode Reference

| Mode | pollInterval | sendInterval | sendNow | When |
|------|-------------|-------------|---------|------|
| `idle` | 60s | `null` | `false` | No active work order |
| `normal` | 10s | 300s (5 min) | `false` | Active WO, readings within limits |
| `urgent` | 10s | 10s | `true` | Active WO, waiting for limits to be met |

### Error Responses

```json
// Missing/invalid API key
{ "success": false, "error": "Unauthorized: invalid or missing X-API-Key" }  // 401

// Missing roomId
{ "success": false, "error": "Missing required query parameter: roomId" }    // 400

// Invalid roomId
{ "success": false, "error": "Invalid roomId — must be a positive integer" } // 400
```

---

## Endpoint 2: Send Reading

```
POST /api/environmental-logs
```

### Purpose

Upload a temperature and humidity reading. The ERP will automatically:
1. Find the active work order using this room
2. Look up the BOM phase for this room
3. Compare reading against BOM environmental limits
4. Store the log with `isNormal` flag
5. Trigger any downstream logic (e.g., phase transition readiness)

### Request

```http
POST /api/environmental-logs HTTP/1.1
Host: herbal-erp-metaherb.bmscloud.in.th
X-API-Key: env-monitor-2026-secret
Content-Type: application/json

{
  "roomId": 3,
  "temperature": 24.5,
  "humidity": 55.2
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roomId` | `number` | ✅ | The room ID configured for this device |
| `temperature` | `number` | ✅ | Temperature in °C (decimal allowed) |
| `humidity` | `number` | ✅ | Relative humidity in % (0-100) |
| `notes` | `string` | ❌ | Optional note (default: "Auto-recorded by IoT sensor") |

### Response

```json
{
  "success": true,
  "data": {
    "logged": 1,
    "details": [
      { "workOrderId": 123, "phase": "production", "isNormal": true }
    ]
  },
  "message": "Logged 1 reading(s) for room 3"
}
```

If no active work order is using this room:

```json
{
  "success": true,
  "data": { "logged": 0 },
  "message": "No active work orders — reading not logged"
}
```

---

## Recommended Device Logic (Pseudocode)

```python
import requests
import time

ROOM_ID = 3
API_KEY = "env-monitor-2026-secret"
BASE_URL = "https://herbal-erp-metaherb.bmscloud.in.th"

HEADERS = {"X-API-Key": API_KEY}

poll_interval = 10        # start with 10 seconds
last_send_time = 0

while True:
    try:
        # 1. Ask ERP what to do
        resp = requests.get(
            f"{BASE_URL}/api/iot/should-send?roomId={ROOM_ID}",
            headers=HEADERS,
            timeout=5,
        ).json()

        # 2. Update our polling interval from server's recommendation
        poll_interval = resp.get("pollInterval", 10)
        mode = resp.get("mode", "idle")
        send_now = resp.get("sendNow", False)
        send_interval = resp.get("sendInterval")

        # 3. Decide whether to send
        should_send = False
        if mode != "idle":
            now = time.time()
            if send_now:
                should_send = True
            elif send_interval and (now - last_send_time) >= send_interval:
                should_send = True

        # 4. Take reading and send
        if should_send:
            temp, humidity = read_sensor()  # your DHT/SHT driver
            requests.post(
                f"{BASE_URL}/api/environmental-logs",
                headers={**HEADERS, "Content-Type": "application/json"},
                json={
                    "roomId": ROOM_ID,
                    "temperature": temp,
                    "humidity": humidity,
                },
                timeout=5,
            )
            last_send_time = time.time()

    except Exception as e:
        # Network error or timeout — don't crash, just try again next cycle
        print(f"Poll error: {e}")

    time.sleep(poll_interval)
```

---

## Behavior Expectations

### Network Resilience
- If a poll or send fails, **do not crash** — log the error and retry on the next cycle.
- The ERP does not track connection state. Every request is independent.

### Clock Sync
- The device does **not** need to send timestamps. The ERP stamps each reading with its own server time (Asia/Bangkok timezone).

### Multiple Devices per Room
- You can have multiple IoT devices in the same room. The ERP treats each reading independently — there is no deduplication.
- If you need to distinguish devices, use the `notes` field.

### Backward Compatibility
- Devices that only implement `POST /api/environmental-logs` (no polling) will continue to work. They just won't benefit from adaptive polling and will send on their own fixed schedule.

---

## Quick Test (cURL)

```bash
# 1. Poll
curl -H "X-API-Key: env-monitor-2026-secret" \
  "https://herbal-erp-metaherb.bmscloud.in.th/api/iot/should-send?roomId=3"

# 2. Send a reading
curl -X POST \
  -H "X-API-Key: env-monitor-2026-secret" \
  -H "Content-Type: application/json" \
  -d '{"roomId": 3, "temperature": 24.5, "humidity": 55}' \
  "https://herbal-erp-metaherb.bmscloud.in.th/api/environmental-logs"
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-10 | Initial spec. Added `GET /api/iot/should-send` polling endpoint. |
