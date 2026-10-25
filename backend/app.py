import os
import sys
import socket
import time
import math
import hashlib
import requests
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

from metrics_collector import MetricsCollector
from instance_manager import InstanceManager
from scaling_controller import ScalingController
from load_generator import LoadGenerator

# Environment Configuration
CLOUDSCALE_MODE = os.environ.get("CLOUDSCALE_MODE", "simulation").strip().lower()
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5000"))
IS_WORKER = (CLOUDSCALE_MODE == "worker")

app = Flask(__name__)
CORS(app)

# Core subsystems
metrics_collector = MetricsCollector(history_maxlen=60, is_worker=IS_WORKER)
instance_manager = InstanceManager(is_simulated=(not IS_WORKER))
scaling_controller = ScalingController(instance_manager, metrics_collector, mode=CLOUDSCALE_MODE)
load_generator = LoadGenerator(metrics_collector, instance_manager)

START_TIME = time.time()

# Cached EC2 instance identity for worker mode
_cached_identity = None

def get_instance_identity():
    """Read instance identity (instance_id, availability_zone) via IMDSv2 with caching and hostname fallback."""
    global _cached_identity
    if _cached_identity is not None:
        return _cached_identity

    instance_id = None
    availability_zone = None

    try:
        token_resp = requests.put(
            "http://169.254.169.254/latest/api/token",
            headers={"X-aws-ec2-metadata-token-ttl-seconds": "60"},
            timeout=1.0
        )
        if token_resp.status_code == 200:
            token = token_resp.text.strip()
            headers = {"X-aws-ec2-metadata-token": token}

            id_resp = requests.get(
                "http://169.254.169.254/latest/meta-data/instance-id",
                headers=headers,
                timeout=1.0
            )
            az_resp = requests.get(
                "http://169.254.169.254/latest/meta-data/placement/availability-zone",
                headers=headers,
                timeout=1.0
            )
            if id_resp.status_code == 200:
                instance_id = id_resp.text.strip()
            if az_resp.status_code == 200:
                availability_zone = az_resp.text.strip()
    except Exception:
        pass

    if not instance_id:
        instance_id = socket.gethostname()
    if not availability_zone:
        availability_zone = "local"

    _cached_identity = {
        "instance_id": instance_id,
        "availability_zone": availability_zone
    }
    return _cached_identity

# Pre-cache identity in worker mode so health checks remain instantaneous
if IS_WORKER:
    get_instance_identity()

# NOTE: Under multiple Gunicorn worker processes, in-memory per-worker request
# counters and sliding-window metrics are partial (each worker only observes
# its own subset of requests). On AWS, ALB and CloudWatch metrics are authoritative.

# Request timing hook
@app.before_request
def before_request():
    request._start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(request, "_start_time") and request.path not in ["/api/metrics", "/api/history", "/metrics"]:
        duration_ms = (time.time() - request._start_time) * 1000.0
        success = response.status_code < 400
        metrics_collector.record_request(duration_ms, success)
        instance_manager.record_request_dispatched()
    return response

# 1. Root status
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "project": "CloudScale — Intelligent Cloud Resource Auto-Scaling and Monitoring System",
        "status": "Operational",
        "version": "1.0.0",
        "mode": "AWS EC2 Worker Mode" if IS_WORKER else "Local Simulation Mode (Kubernetes compatible)",
        "uptime_seconds": int(time.time() - START_TIME),
        "endpoints": [
            "/health",
            "/compute",
            "/api/metrics",
            "/api/instances",
            "/api/history",
            "/api/scaling/status",
            "/api/scaling/config",
            "/api/events",
            "/api/load/start",
            "/api/load/stop",
            "/metrics"
        ]
    })

# 2. Health check (ALB health check & K8s liveness/readiness compatible)
@app.route("/health", methods=["GET"])
def health():
    try:
        resp = {
            "status": "healthy",
            "timestamp": int(time.time()),
            "uptime_seconds": int(time.time() - START_TIME)
        }
        if IS_WORKER:
            identity = get_instance_identity()
            resp["instance_id"] = identity["instance_id"]
            resp["availability_zone"] = identity["availability_zone"]
        else:
            resp["replicas_active"] = scaling_controller.current_replicas
        return jsonify(resp), 200
    except Exception as e:
        return jsonify({"status": "healthy", "error": str(e)}), 200

# 3. Current metrics
@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    current_metrics = metrics_collector.get_current_metrics(scaling_controller.current_replicas)
    scaling_status = scaling_controller.get_status()
    load_status = load_generator.get_status()

    return jsonify({
        "metrics": current_metrics,
        "scaling": scaling_status,
        "load_test": load_status,
        "timestamp": int(time.time())
    })

# 4. Instances / Replicas
@app.route("/api/instances", methods=["GET"])
def get_instances():
    current_metrics = metrics_collector.get_current_metrics(scaling_controller.current_replicas)
    instances = instance_manager.get_instances(current_metrics["cpu_utilization"])
    return jsonify({
        "instances": instances,
        "count": len(instances),
        "mode": scaling_controller.mode,
        "is_simulated": scaling_controller.is_simulated
    })

# 5. Scaling Status
@app.route("/api/scaling/status", methods=["GET"])
def get_scaling_status():
    return jsonify(scaling_controller.get_status())

# 6. Scaling Configuration
@app.route("/api/scaling/config", methods=["GET", "POST"])
def scaling_config():
    if request.method == "POST":
        data = request.get_json() or {}
        new_config = scaling_controller.update_config(
            min_replicas=data.get("min_replicas"),
            max_replicas=data.get("max_replicas"),
            scale_out_threshold=data.get("scale_out_threshold"),
            scale_in_threshold=data.get("scale_in_threshold"),
            cooldown_seconds=data.get("cooldown_seconds")
        )
        return jsonify({
            "message": "Scaling policy updated successfully",
            "config": new_config
        })
    return jsonify(scaling_controller.get_config())

# 7. Historical monitoring data for charts
@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify({
        "history": metrics_collector.get_history(),
        "count": len(metrics_collector.history)
    })

# 8. Scaling event log
@app.route("/api/events", methods=["GET"])
def get_events():
    return jsonify({
        "events": scaling_controller.get_events()
    })

@app.route("/api/events/clear", methods=["POST"])
def clear_events():
    scaling_controller.clear_events()
    return jsonify({"message": "Scaling event history cleared"})

# 9. Load testing controls
@app.route("/api/load/start", methods=["POST"])
def start_load():
    data = request.get_json() or {}
    concurrency = data.get("concurrency", 20)
    duration = data.get("duration", 45)
    intensity = data.get("intensity", "high")

    status = load_generator.start(concurrency=concurrency, duration_seconds=duration, intensity=intensity)
    return jsonify({
        "message": "Load test workload started",
        "status": status
    })

@app.route("/api/load/stop", methods=["POST"])
def stop_load():
    status = load_generator.stop()
    return jsonify({
        "message": "Load test workload terminated",
        "status": status
    })

# 10. Compute endpoint (Bounded CPU work)
@app.route("/compute", methods=["GET", "POST"])
def compute():
    # Bounded iterations (default 30,000, capped between 1,000 and 150,000)
    raw_iterations = request.args.get("iterations", 30000)
    try:
        iterations = min(150000, max(1000, int(raw_iterations)))
    except ValueError:
        iterations = 30000

    start = time.perf_counter()
    # Perform bounded mathematical and hashing operations
    digest = "seed"
    val = 0.0
    for i in range(iterations):
        val += math.sqrt(i + 1)
        if i % 5000 == 0:
            digest = hashlib.sha256(f"{val}:{digest}".encode()).hexdigest()
    
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    resp_data = {
        "status": "computed",
        "iterations": iterations,
        "checksum": digest[:12],
        "compute_time_ms": round(elapsed_ms, 2)
    }
    if IS_WORKER:
        identity = get_instance_identity()
        resp_data["instance_id"] = identity["instance_id"]
        resp_data["availability_zone"] = identity["availability_zone"]
    else:
        resp_data["active_replicas"] = scaling_controller.current_replicas

    return jsonify(resp_data)

# 11. Prometheus metrics format
@app.route("/metrics", methods=["GET"])
def prometheus_metrics():
    curr = metrics_collector.get_current_metrics(scaling_controller.current_replicas)
    status = scaling_controller.get_status()

    lines = [
        "# HELP cloudscale_cpu_utilization_percent Current CPU utilization percentage",
        "# TYPE cloudscale_cpu_utilization_percent gauge",
        f"cloudscale_cpu_utilization_percent {curr['cpu_utilization']}",
        "",
        "# HELP cloudscale_replicas_count Active replica count",
        "# TYPE cloudscale_replicas_count gauge",
        f"cloudscale_replicas_count {status['current_replicas']}",
        "",
        "# HELP cloudscale_requests_total Total HTTP requests processed",
        "# TYPE cloudscale_requests_total counter",
        f"cloudscale_requests_total {curr['total_requests']}",
        "",
        "# HELP cloudscale_requests_per_second Incoming requests per second",
        "# TYPE cloudscale_requests_per_second gauge",
        f"cloudscale_requests_per_second {curr['requests_per_second']}",
        "",
        "# HELP cloudscale_latency_average_milliseconds Average response latency in ms",
        "# TYPE cloudscale_latency_average_milliseconds gauge",
        f"cloudscale_latency_average_milliseconds {curr['average_latency_ms']}",
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain; version=0.0.4")

if __name__ == "__main__":
    print(f"[CloudScale Backend] Starting server on http://{HOST}:{PORT} ...")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
