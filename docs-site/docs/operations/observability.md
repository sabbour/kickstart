---
sidebar_position: 1
---

# Observability

Application Insights is the observability backbone for Kickstart's deployed API. The Functions backend automatically exports traces, logs, and metrics to AppInsights via `@azure/monitor-opentelemetry`.

## Overview

The Kickstart API leverages Azure Application Insights for:
- **Distributed tracing:** Request flows across the API, AI services, and third-party integrations.
- **Logs:** Structured application logs and SDK logs.
- **Metrics:** Request rates, response times, error rates, and custom business metrics.
- **Live Metrics:** Real-time telemetry visualization (1–2 min latency).

Telemetry is collected automatically by the `@azure/monitor-opentelemetry` SDK initialized in `packages/web/api/src/startup/appinsights.ts`.

## Required Setup

### AppInsights Connection String

The telemetry SDK requires the **Application Insights connection string** to be set in the environment. The setting name is **case-sensitive**:

- **Setting name:** `APPLICATIONINSIGHTS_CONNECTION_STRING` (exact spelling)
- **Where to get it:** [Azure Portal](https://portal.azure.com) → Application Insights resource → **Overview** → copy the **Connection String**

### On a Deployed Static Web App

If AppInsights is already deployed (or available separately), set the app setting on your SWA:

```bash
az staticwebapp appsettings set \
  --name <swa-name> \
  --resource-group <rg> \
  --setting-names "APPLICATIONINSIGHTS_CONNECTION_STRING=<paste-from-ai-portal>"
```

The SWA's Functions backend will restart automatically (~30–60 seconds), and telemetry will flow to AppInsights.

For more details, see `infra/README.md` → **Bring-your-own AppInsights**.

### For Local Development

Add the connection string to `packages/web/api/local.settings.json` (this file is `.gitignore`d):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "<paste-from-ai-portal>"
  }
}
```

Restart your local Functions app (`npm run dev` in `packages/web/api`).

## Verifying Telemetry

### 1. Generate a request

```bash
curl https://<swa-host>/api/health
```

You should receive a 200 response.

### 2. Check Live Metrics (1–2 min latency)

1. Open [Azure Portal](https://portal.azure.com)
2. Navigate to your **Application Insights** resource
3. Click **Live Metrics** (left sidebar)
4. Watch for incoming requests, dependencies, and exceptions

### 3. Query historical data

Click **Logs** in the AppInsights resource and run one of these KQL queries:

**Last 5 minutes of traces:**
```kql
traces | where timestamp > ago(5m) | take 20
```

**Last 5 minutes of requests:**
```kql
requests | where timestamp > ago(5m) | take 20
```

**Request duration, by operation:**
```kql
requests
| summarize avg_duration = avg(duration), count = count() by operation_Name
| order by avg_duration desc
```

**Failed requests:**
```kql
requests | where success == false | take 20
```

## Troubleshooting

### No telemetry appearing in AppInsights

**Check 1: App setting is set correctly**
- Name must be exactly `APPLICATIONINSIGHTS_CONNECTION_STRING` (case-sensitive)
- Run: `az staticwebapp appsettings list --name <swa-name> --resource-group <rg>`
- Look for the exact key and verify the value is not empty

**Check 2: SWA has restarted**
- Wait 60 seconds after setting the app setting
- The SWA automatically restarts its Functions backend on app-setting changes

**Check 3: Ingestion latency**
- AppInsights can take up to 5 minutes to display newly ingested data
- Check **Live Metrics** first (1–2 min latency)

**Check 4: Connection string is valid**
- Copy the connection string directly from [Azure Portal](https://portal.azure.com) → AppInsights resource → **Overview**
- Do not modify or truncate the string; use the full value including `InstrumentationKey=...` and `IngestionEndpoint=...`

**Check 5: AppInsights resource is accessible**
- Verify the AppInsights resource exists in the Azure Portal
- Verify the instrumentation key matches what you're setting (if you have multiple AppInsights resources, confirm you're using the correct one)

### "Connection string not found" errors in Function logs

- App setting `APPLICATIONINSIGHTS_CONNECTION_STRING` was not set before the SWA Functions host started
- Set the app setting and wait for the SWA to restart (~60 seconds)
- View Function app logs in [Azure Portal](https://portal.azure.com) → SWA resource → **Logs** or **Log stream**

### Telemetry gaps or gaps in Live Metrics

- The SWA may be idle and scaling down; generate a request to wake it up
- Live Metrics has 1–2 min latency; querying **Logs** shows data with less latency once ingested
- Check network connectivity between SWA and AppInsights ingestion endpoint (very rare; typically `dc.applicationinsights.azure.com`)

## Structured Logging

The SDK exports structured logs. To filter by custom properties:

**By custom dimension:**
```kql
traces
| where customDimensions.user_id == "12345"
| order by timestamp desc
```

**By severity level:**
```kql
traces
| where severityLevel >= 2  // Warning or higher
| order by timestamp desc
```

## Performance Tuning

- **Sampling:** By default, AppInsights ingests all telemetry. For high-volume deployments, configure adaptive sampling in the SDK.
- **Retention:** Default retention is 30 days (configurable in AppInsights → **Usage and estimated costs** → **Data retention**).
- **Costs:** Ingestion is charged per GB. Monitor your data volume in AppInsights → **Usage and estimated costs**.
