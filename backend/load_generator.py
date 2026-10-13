import time
import threading
import math
import random

class LoadGenerator:
    def __init__(self, metrics_collector, instance_manager):
        self.metrics_collector = metrics_collector
        self.instance_manager = instance_manager
        self.lock = threading.Lock()
        
        self.is_active = False
        self.concurrency = 15
        self.duration_seconds = 45
        self.start_time = 0.0
        self.end_time = 0.0
        self.target_intensity = "high" # "low", "medium", "high", "stress"
        
        self._worker_thread = None

    def start(self, concurrency: int = 15, duration_seconds: int = 45, intensity: str = "high"):
        with self.lock:
            self.concurrency = max(1, int(concurrency))
            self.duration_seconds = max(5, int(duration_seconds))
            self.target_intensity = intensity.lower()
            self.is_active = True
            self.start_time = time.time()
            self.end_time = self.start_time + self.duration_seconds

            intensity_map = {
                "low": 35.0,
                "medium": 65.0,
                "high": 85.0,
                "stress": 98.0
            }
            target_load = intensity_map.get(self.target_intensity, 80.0)
            # Scale slightly with concurrency
            effective_load = min(100.0, target_load + (self.concurrency * 0.4))
            self.metrics_collector.set_synthetic_load(effective_load)

            if self._worker_thread is None or not self._worker_thread.is_alive():
                self._worker_thread = threading.Thread(target=self._run_loop, daemon=True)
                self._worker_thread.start()

        return self.get_status()

    def stop(self):
        with self.lock:
            self.is_active = False
            self.metrics_collector.set_synthetic_load(0.0)
        return self.get_status()

    def get_status(self):
        with self.lock:
            now = time.time()
            if self.is_active and now >= self.end_time:
                self.is_active = False
                self.metrics_collector.set_synthetic_load(0.0)

            remaining = max(0, int(self.end_time - now)) if self.is_active else 0
            elapsed = max(0, int(now - self.start_time)) if self.is_active else 0

            return {
                "is_active": self.is_active,
                "concurrency": self.concurrency,
                "duration_seconds": self.duration_seconds,
                "elapsed_seconds": elapsed,
                "remaining_seconds": remaining,
                "intensity": self.target_intensity
            }

    def _run_loop(self):
        """Simulate high-frequency incoming request traffic during load test."""
        while True:
            with self.lock:
                if not self.is_active:
                    break
                if time.time() >= self.end_time:
                    self.is_active = False
                    self.metrics_collector.set_synthetic_load(0.0)
                    break
                concurrency = self.concurrency

            # Generate batch of requests proportional to concurrency
            batch_size = max(2, int(concurrency * 1.5))
            for _ in range(batch_size):
                latency = random.uniform(8.0, 28.0)
                # Dispatch through load balancer
                self.instance_manager.record_request_dispatched()
                self.metrics_collector.record_request(latency_ms=latency, success=True)

            time.sleep(0.1) # 10 ticks per second = realistic continuous traffic
