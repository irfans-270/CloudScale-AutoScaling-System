# CloudScale — Intelligent Cloud Resource Auto-Scaling & Monitoring System

A functional, demo-ready prototype demonstrating cloud elasticity, load balancing, Horizontal Pod Autoscaling (HPA), and workload monitoring.

---

## 1. Project Objectives & Core Concepts Demonstrated

- **Dynamic Scalability & Elasticity**: Dynamic capacity scaling based on real-time computational load.
- **Load Balancing & Distribution**: Round-robin request routing across available replica pods, shedding per-pod load as replicas scale out.
- **Replica Pool Management**: Lifecycle management of worker instances (provisioning, health verification, graceful decommissioning).
- **CPU & Latency Telemetry**: Real-time tracking of cluster CPU utilization, Requests Per Second (RPS), and p50/p95 latency.
- **Auto Scale-Out**: Gradual capacity expansion when CPU utilization exceeds 60%.
- **Auto Scale-In**: Graceful capacity reduction when CPU utilization drops below 25%.
- **Oscillation Stabilization**: Configurable cooldown periods (default: 15s) preventing rapid flapping.
- **Audit Logging**: Structured event logs recording triggers, metrics, and capacity transitions.

---

## 2. Architecture & Technology Stack

```
+---------------------------------------------------------------------------------+
|                                 USER BROWSER                                    |
|                       React 19 + Vite + Tailwind CSS v4                         |
|                     Recharts Live Telemetry Visualizations                      |
|                           (http://127.0.0.1:3000)                               |
+---------------------------------------+-----------------------------------------+
                                        | HTTP / REST (1s Telemetry Poll)
                                        v
+---------------------------------------------------------------------------------+
|                                 FLASK BACKEND                                   |
|                             (http://127.0.0.1:5000)                             |
|  +----------------------+ +-------------------------+ +-----------------------+ |
|  |   Metrics Engine     | |   Scaling Controller    | |   Instance Pool Mgr   | |
|  | - Cluster CPU %      | | - Threshold Evaluation  | | - Pod representations | |
|  | - Sliding window RPS | | - Cooldown Enforcement  | | - Round-robin router  | |
|  | - Latency p50 / p95  | | - Event Audit Logger    | | - Local / K8s mode    | |
|  +----------------------+ +-------------------------+ +-----------------------+ |
|  +----------------------------------------------------------------------------+ |
|  |                  Workload Engine & Bounded /compute Endpoint               | |
|  +----------------------------------------------------------------------------+ |
+---------------------------------------+-----------------------------------------+
                                        |
                 +----------------------+----------------------+
                 v                                             v
+---------------------------------+           +---------------------------------+
|      LOCAL SIMULATION MODE      |           |     KUBERNETES / DOCKER MODE    |
| - High-fidelity local pool      |           | - k8s/deployment.yaml           |
| - Active in Windows standalone  |           | - k8s/hpa.yaml (target: 60% CPU)|
| - Real algorithms & math        |           | - k8s/service.yaml (NodePort)   |
+---------------------------------+           +---------------------------------+
```

- **Frontend**: React 19, Vite, Tailwind CSS v4, Recharts, Lucide Icons.
- **Backend**: Python 3.11/3.13, Flask, Flask-CORS, psutil, requests.
- **Testing**: Built-in interactive stress generator & standalone CLI `scripts/load_test.py`.
- **Containers & Cloud**: Dockerfiles, `docker-compose.yml`, Kubernetes `deployment.yaml`, `service.yaml`, `hpa.yaml`.

> **Note on Local Simulation Mode:**
> If Docker or Kubernetes is not installed on the host machine, CloudScale automatically operates in **Local Auto-Scaling Simulation Mode**. In this mode, the scaling controller, threshold evaluation, and metrics algorithms run live code in Python. Simulated replica pods are clearly labeled as simulated, and Kubernetes manifests are provided for cluster deployments.

---

## 3. Quick Start (Windows PowerShell)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Terminal 1: Start Backend API (Port 5000)
```powershell
# Navigate to project directory
Set-Location "d:\Cloud proj"

# Activate the virtual environment
.\venv\Scripts\Activate.ps1

# Run Flask backend server
python backend/app.py
```
*Backend starts on `http://127.0.0.1:5000`.*

### Terminal 2: Start Frontend Dashboard (Port 3000)
```powershell
# Open a new terminal in project directory
Set-Location "d:\Cloud proj\frontend"

# Launch Vite development server
npm run dev -- --host 127.0.0.1
```
*Frontend opens at `http://127.0.0.1:3000`.*

---

## 4. Demonstrating the 9-Step Evaluation Scenario

To demonstrate the full lifecycle to college faculty, follow these steps:

### Option A: Automated Demo via PowerShell Script
Run the automated demonstration script:
```powershell
powershell -ExecutionPolicy Bypass -File "d:\Cloud proj\scripts\demo_script.ps1"
```

### Option B: Interactive Visual Demo (Recommended for Presentation)
1. **Initial State**:
   - Open `http://127.0.0.1:3000`.
   - Observe **1 Active Replica** in the metric card and the **Cluster Stable** badge.
   - Point out baseline idle CPU (8% - 15%), RPS (0 req/s), and sub-10ms response latency.

2. **Trigger Traffic Load**:
   - Scroll to the **Workload Stress Generator** panel or click **⚡ Run Demo Flow** in the top header.
   - Alternatively, click **Start Load Test** with 25 concurrent users and 45s duration.

3. **Observe Workload Increase**:
   - Observe incoming throughput rise to 200–350 RPS on the **Throughput (RPS)** chart.
   - Watch the **CPU Utilization Over Time** chart spike past 60%.

4. **Demonstrate Scale-Out**:
   - The scaling status changes to **Scaling Out**.
   - Active replica capacity increases from **1 ➔ 2** (and then to **3** if load is sustained).
   - Point out that each new replica dilutes per-pod CPU load and reduces latency.

5. **Stop Load Test**:
   - Click **Stop Load Test** (or allow the timer to expire).
   - Incoming throughput immediately drops to 0 RPS.

6. **Observe Stabilization & Scale-In**:
   - The scaling status displays **Stabilizing (Cooldown: 15s)** to prevent rapid oscillation (anti-flapping).
   - Once the cooldown timer elapses and CPU drops below 25%, a **SCALE_IN** event triggers.
   - Replicas decrement gradually from **3 ➔ 2 ➔ 1**.

7. **Review Scaling Event Log**:
   - Navigate to the **Scaling Event Log** tab.
   - Highlight the timestamped audit log detailing exact trigger percentages, reasons, previous vs new replica counts, and actions.

---

## 5. Standalone Load Testing via Python CLI

You can also generate synthetic traffic from the command line:

```powershell
# Run 15 concurrent clients for 30 seconds
& "d:\Cloud proj\venv\Scripts\python.exe" "d:\Cloud proj\scripts\load_test.py" -c 15 -d 30 -i 25000
```

CLI Parameters:
- `-c, --concurrency`: Number of concurrent client worker threads (default: 15)
- `-d, --duration`: Total test duration in seconds (default: 30)
- `-i, --iterations`: Computation iterations per `/compute` call (default: 25000)
- `--url`: Backend target URL (default: `http://127.0.0.1:5000`)

---

## 6. Kubernetes & Minikube Deployment Guide

When Docker and Minikube are available, deploy CloudScale to a real Kubernetes cluster:

```bash
# 1. Start Minikube with metrics-server enabled (required for HPA)
minikube start
minikube addons enable metrics-server

# 2. Build backend Docker image inside Minikube's Docker daemon
eval $(minikube docker-env)
docker build -t cloudscale-backend:1.0.0 -f docker/Dockerfile.backend .

# 3. Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# 4. Verify deployment and autoscaler status
kubectl get deployments
kubectl get pods -l app=cloudscale-backend
kubectl get hpa cloudscale-hpa --watch

# 5. Expose service port
minikube service cloudscale-service --url
```

---

## 7. REST API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | System status, project metadata, and available endpoints |
| `GET` | `/health` | Health check endpoint (Kubernetes liveness/readiness probe target) |
| `GET` | `/api/metrics` | Real-time cluster CPU, RPS, latency, and scaling status |
| `GET` | `/api/instances` | List of active replica pods, individual CPU%, and IPs |
| `GET` | `/api/history` | Rolling time-series history for dashboard charts |
| `GET` | `/api/scaling/status` | Current controller state, replica count, cooldown countdown |
| `GET` | `/api/scaling/config` | Retrieve current HPA policy thresholds |
| `POST` | `/api/scaling/config` | Update min/max replicas, scale-in/out thresholds, cooldown |
| `GET` | `/api/events` | Audit trail of all scaling decisions |
| `POST` | `/api/events/clear` | Clear scaling event history |
| `POST` | `/api/load/start` | Start internal traffic generator (`concurrency`, `duration`, `intensity`) |
| `POST` | `/api/load/stop` | Terminate active internal load generator |
| `GET` | `/compute` | Bounded CPU-intensive computation endpoint |
| `GET` | `/metrics` | Prometheus-formatted plaintext metrics endpoint |

---

## 8. Implemented Features vs Pending Features

### Implemented (50% MVP Target - Completed)
- [x] Flask REST backend with 12 endpoints.
- [x] Thread-safe Metrics Collector tracking CPU, RPS, average latency, and p95.
- [x] Horizontal Auto-Scaling Controller with threshold evaluation and cooldown stabilization.
- [x] Gradual scale-out (increment by 1) and gradual scale-in (decrement by 1).
- [x] Scaling event audit logger recording timestamps, triggers, and replica counts.
- [x] Multi-tab React + Vite + Tailwind CSS v4 dashboard in modern dark theme.
- [x] 4 live Recharts time-series graphs (CPU, Replicas, RPS, Latency).
- [x] Interactive Workload Stress Generator with concurrency, duration, and intensity sliders.
- [x] Dynamic Autoscaling Policy adjustment form.
- [x] Standalone Python CLI load testing tool (`scripts/load_test.py`).
- [x] Automated PowerShell demo sequence script (`scripts/demo_script.ps1`).
- [x] Prometheus-compatible metrics endpoint (`/metrics`).
- [x] Production Dockerfile and docker-compose configurations.
- [x] Kubernetes Deployment, Service (NodePort), and HorizontalPodAutoscaler (HPA) manifests.
- [x] Clear disclosure and visual indicators of Local Simulation Mode.

### Pending / Future Enhancements (Post-MVP)
- [ ] Direct Prometheus server scraping and Grafana dashboard provisioning.
- [ ] Helm chart packaging for one-click Kubernetes deployment.
- [ ] AWS CloudWatch and AWS Application Auto Scaling group integration.
- [ ] JWT authentication for administrator policy changes.
