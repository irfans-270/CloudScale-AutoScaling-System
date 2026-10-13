# CloudScale Automated Demo Script for Windows PowerShell
# Demonstrates: Baseline Telemetry -> Load Spike -> Auto Scale-Out -> Load Drop -> Auto Scale-In -> Event Log

$BaseUrl = "http://127.0.0.1:5000"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   CloudScale -- Auto-Scaling Live Demonstration Script" -ForegroundColor Yellow
Write-Host "   College Evaluation and Faculty Demo Workflow" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Step 1: Health and Initial State
Write-Host "`n[Step 1] Connecting to CloudScale Backend..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health"
    $metrics = Invoke-RestMethod -Uri "$BaseUrl/api/metrics"
    Write-Host "  [OK] System Status: $($health.status)" -ForegroundColor White
    Write-Host "  [OK] Active Replicas: $($health.replicas_active)" -ForegroundColor White
} catch {
    Write-Host "  [ERROR] Could not reach backend at $BaseUrl. Start the backend first!" -ForegroundColor Red
    exit 1
}

# Step 2: Show Baseline Metrics
Write-Host "`n[Step 2] Baseline Steady-State Telemetry:" -ForegroundColor Green
$m = $metrics.metrics
Write-Host "  CPU Utilization:    $($m.cpu_utilization)%" -ForegroundColor White
Write-Host "  Requests Per Sec:   $($m.requests_per_second) req/s" -ForegroundColor White
Write-Host "  Average Latency:    $($m.average_latency_ms) ms" -ForegroundColor White
Write-Host "  Scaling State:      $($metrics.scaling.scaling_status)" -ForegroundColor White

# Step 3: Trigger High Load
Write-Host "`n[Step 3] Initiating Traffic Stress Test (Triggering Scale-Out)..." -ForegroundColor Yellow
$loadParams = @{
    concurrency = 25
    duration = 30
    intensity = "high"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$BaseUrl/api/load/start" -Method Post -Body $loadParams -ContentType "application/json" | Out-Null
Write-Host "  [OK] Injected 25 concurrent users. Monitoring CPU spike..." -ForegroundColor White

# Step 4 and 5: Watch Scale Out
Write-Host "`n[Step 4 and 5] Watching Cluster Telemetry and Auto-Scale Out..." -ForegroundColor Yellow
for ($i = 1; $i -le 8; $i++) {
    Start-Sleep -Seconds 2
    $sample = Invoke-RestMethod -Uri "$BaseUrl/api/metrics"
    $cpu = $sample.metrics.cpu_utilization
    $reps = $sample.scaling.current_replicas
    $stat = $sample.scaling.scaling_status
    $rps = $sample.metrics.requests_per_second
    Write-Host "  [$($i*2)s] CPU: $cpu% | RPS: $rps | Replicas: $reps | Status: $stat" -ForegroundColor Cyan
}

# Step 6: Stop Load Test
Write-Host "`n[Step 6] Terminating Workload Generation..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BaseUrl/api/load/stop" -Method Post | Out-Null
Write-Host "  [OK] Load stopped. Observing workload reduction..." -ForegroundColor White

# Step 7 and 8: Observe Scale In
Write-Host "`n[Step 7 and 8] Waiting for Cooldown Stabilization and Scale-In..." -ForegroundColor Yellow
for ($i = 1; $i -le 7; $i++) {
    Start-Sleep -Seconds 3
    $sample = Invoke-RestMethod -Uri "$BaseUrl/api/metrics"
    $cpu = $sample.metrics.cpu_utilization
    $reps = $sample.scaling.current_replicas
    $stat = $sample.scaling.scaling_status
    Write-Host "  [$($i*3)s after load] CPU: $cpu% | Replicas: $reps | Status: $stat" -ForegroundColor Magenta
}

# Step 9: Audit Log Summary
Write-Host "`n[Step 9] Scaling Events Audit Log:" -ForegroundColor Green
$events = Invoke-RestMethod -Uri "$BaseUrl/api/events"
foreach ($evt in $events.events | Select-Object -First 5) {
    Write-Host "  * [$($evt.timestamp)] $($evt.action): $($evt.previous_replicas) -> $($evt.new_replicas) replicas (CPU: $($evt.measured_cpu)%)" -ForegroundColor White
    Write-Host "    Reason: $($evt.reason)" -ForegroundColor Gray
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host " Demonstration Sequence Completed Successfully!" -ForegroundColor Green
Write-Host " Frontend Dashboard is available at: http://127.0.0.1:3000" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
