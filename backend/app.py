import time
import math
import hashlib
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

from metrics_collector import MetricsCollector
from instance_manager import InstanceManager
from scaling_controller import ScalingController
from load_generator import LoadGenerator

app = Flask(__name__)
CORS(app)

# Core subsystems
metrics_collector = MetricsCollector(history_maxlen=60)
instance_manager = InstanceManager(is_simulated=True)
scaling_controller = ScalingController(instance_manager, metrics_collector)
load_generator = LoadGenerator(metrics_collector, instance_manager)

START_TIME = time.time()

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
        "mode": "Local Simulation Mode (Kubernetes compatible)",
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

# 2. Health check (K8s liveness & readiness compatible)
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": int(time.time()),
        "uptime_seconds": int(time.time() - START_TIME),
        "replicas_active": scaling_controller.current_replicas
    }), 200

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

    return jsonify({
        "status": "computed",
        "iterations": iterations,
        "checksum": digest[:12],
        "compute_time_ms": round(elapsed_ms, 2),
        "active_replicas": scaling_controller.current_replicas
    })

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
    print("[CloudScale Backend] Starting server on http://127.0.0.1:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
