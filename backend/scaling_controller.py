import time
import threading
import uuid
from typing import List, Dict, Any

class ScalingController:
    def __init__(self, instance_manager, metrics_collector, mode: str = "simulation"):
        self.instance_manager = instance_manager
        self.metrics_collector = metrics_collector
        self.lock = threading.Lock()
        
        # Policy Configuration
        self.min_replicas = 1
        self.max_replicas = 4
        self.scale_out_threshold = 60.0  # Percentage
        self.scale_in_threshold = 25.0   # Percentage
        self.cooldown_seconds = 15       # Fast enough for live college demo
        
        # Operational State
        self.mode = mode
        self.is_simulated = (mode == "simulation")
        self.current_replicas = self.min_replicas
        if self.is_simulated:
            self.instance_manager.set_replica_count(self.current_replicas)
        self.scaling_status = "Stable"
        self.last_scaling_time = 0.0
        
        # Event History (newest first)
        self.scaling_events: List[Dict[str, Any]] = []
        
        # Background control loop (only in simulation mode)
        self._running = True
        if self.is_simulated:
            self._worker_thread = threading.Thread(target=self._control_loop, daemon=True)
            self._worker_thread.start()
        else:
            self._worker_thread = None

    def update_config(self, min_replicas=None, max_replicas=None, 
                      scale_out_threshold=None, scale_in_threshold=None, 
                      cooldown_seconds=None):
        with self.lock:
            if min_replicas is not None:
                self.min_replicas = max(1, int(min_replicas))
            if max_replicas is not None:
                self.max_replicas = max(self.min_replicas, int(max_replicas))
            if scale_out_threshold is not None:
                self.scale_out_threshold = float(scale_out_threshold)
            if scale_in_threshold is not None:
                self.scale_in_threshold = float(scale_in_threshold)
            if cooldown_seconds is not None:
                self.cooldown_seconds = max(5, int(cooldown_seconds))

            # Clamp current replicas within new limits
            if self.current_replicas < self.min_replicas:
                self.current_replicas = self.min_replicas
                if self.is_simulated:
                    self.instance_manager.set_replica_count(self.current_replicas)
            elif self.current_replicas > self.max_replicas:
                self.current_replicas = self.max_replicas
                if self.is_simulated:
                    self.instance_manager.set_replica_count(self.current_replicas)

        return self.get_config()

    def get_config(self):
        with self.lock:
            return {
                "min_replicas": self.min_replicas,
                "max_replicas": self.max_replicas,
                "scale_out_threshold": self.scale_out_threshold,
                "scale_in_threshold": self.scale_in_threshold,
                "cooldown_seconds": self.cooldown_seconds,
                "mode": self.mode,
                "is_simulated": self.is_simulated
            }

    def get_status(self):
        with self.lock:
            now = time.time()
            elapsed_since_scale = now - self.last_scaling_time
            in_cooldown = elapsed_since_scale < self.cooldown_seconds
            cooldown_remaining = max(0, int(self.cooldown_seconds - elapsed_since_scale)) if in_cooldown else 0

            return {
                "current_replicas": self.current_replicas,
                "min_replicas": self.min_replicas,
                "max_replicas": self.max_replicas,
                "scaling_status": self.scaling_status,
                "in_cooldown": in_cooldown,
                "cooldown_remaining": cooldown_remaining,
                "mode": self.mode,
                "is_simulated": self.is_simulated,
                "total_events": len(self.scaling_events)
            }

    def get_events(self):
        with self.lock:
            return list(self.scaling_events)

    def clear_events(self):
        with self.lock:
            self.scaling_events.clear()

    def _record_event(self, action: str, prev_replicas: int, new_replicas: int, 
                      cpu_val: float, reason: str):
        event = {
            "id": f"evt-{uuid.uuid4().hex[:8]}",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "action": action,
            "previous_replicas": prev_replicas,
            "new_replicas": new_replicas,
            "measured_cpu": round(cpu_val, 1),
            "reason": reason,
            "mode": "Simulated Replica Pool" if self.is_simulated else "Kubernetes HPA"
        }
        self.scaling_events.insert(0, event)
        if len(self.scaling_events) > 50:
            self.scaling_events.pop()

    def _control_loop(self):
        """Autoscaling decision loop running every 1 second."""
        while self._running:
            time.sleep(1.0)
            try:
                metrics = self.metrics_collector.get_current_metrics(self.current_replicas)
                current_cpu = metrics["cpu_utilization"]
                
                # Push time-series history point
                self.metrics_collector.push_history_point(metrics, self.current_replicas)

                with self.lock:
                    now = time.time()
                    elapsed_since_scale = now - self.last_scaling_time
                    in_cooldown = elapsed_since_scale < self.cooldown_seconds

                    if in_cooldown:
                        cooldown_rem = int(self.cooldown_seconds - elapsed_since_scale)
                        self.scaling_status = f"Stabilizing (Cooldown: {cooldown_rem}s)"
                        continue

                    # Evaluation logic:
                    # 1. Scale Out if CPU > threshold and current < max
                    if current_cpu >= self.scale_out_threshold and self.current_replicas < self.max_replicas:
                        prev = self.current_replicas
                        # Gradual scaling: increment by 1
                        self.current_replicas += 1
                        self.last_scaling_time = now
                        self.scaling_status = "Scaling Out"
                        
                        reason = (f"CPU utilization ({current_cpu}%) exceeded scale-out threshold "
                                  f"({self.scale_out_threshold}%). Provisioning new replica to balance workload.")
                        self._record_event("SCALE_OUT", prev, self.current_replicas, current_cpu, reason)
                        self.instance_manager.set_replica_count(self.current_replicas)

                    # 2. Scale In if CPU < threshold and current > min
                    elif current_cpu <= self.scale_in_threshold and self.current_replicas > self.min_replicas:
                        prev = self.current_replicas
                        # Gradual scaling: decrement by 1
                        self.current_replicas -= 1
                        self.last_scaling_time = now
                        self.scaling_status = "Scaling In"
                        
                        reason = (f"CPU utilization ({current_cpu}%) dropped below scale-in threshold "
                                  f"({self.scale_in_threshold}%). Decommissioning idle replica to conserve resources.")
                        self._record_event("SCALE_IN", prev, self.current_replicas, current_cpu, reason)
                        self.instance_manager.set_replica_count(self.current_replicas)

                    else:
                        self.scaling_status = "Stable"

            except Exception as e:
                # Keep loop resilient
                pass
