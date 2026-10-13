#!/usr/bin/env python3
"""
CloudScale — Automated HTTP Load & Autoscaling Stress Generator
Simulates concurrent clients hitting the /compute workload endpoint
to trigger CPU utilization spikes and Horizontal Auto-Scaling.
"""

import sys
import time
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor
import requests

class LoadTester:
    def __init__(self, target_url: str, concurrency: int, duration: int, iterations: int):
        self.target_url = target_url.rstrip("/")
        self.concurrency = concurrency
        self.duration = duration
        self.iterations = iterations
        
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.latencies = []
        self.lock = threading.Lock()
        self.running = False

    def _worker(self, worker_id: int):
        compute_url = f"{self.target_url}/compute?iterations={self.iterations}"
        session = requests.Session()
        
        while self.running:
            t0 = time.perf_counter()
            try:
                resp = session.get(compute_url, timeout=5.0)
                latency_ms = (time.perf_counter() - t0) * 1000.0
                with self.lock:
                    self.total_requests += 1
                    if resp.status_code == 200:
                        self.successful_requests += 1
                        self.latencies.append(latency_ms)
                    else:
                        self.failed_requests += 1
            except Exception:
                with self.lock:
                    self.total_requests += 1
                    self.failed_requests += 1
            
            time.sleep(0.02) # Prevent socket exhaustion while keeping continuous pressure

    def run(self):
        print("=" * 65)
        print(f" CloudScale — Load Testing & Stress Scenario")
        print(f" Target: {self.target_url}/compute")
        print(f" Concurrency: {self.concurrency} threads | Duration: {self.duration}s | Compute Iterations: {self.iterations}")
        print("=" * 65)
        
        # Also inform the backend load coordinator so metrics & cluster CPU reflect workload
        try:
            requests.post(f"{self.target_url}/api/load/start", json={
                "concurrency": self.concurrency,
                "duration": self.duration,
                "intensity": "high"
            }, timeout=2.0)
        except Exception:
            pass

        self.running = True
        start_time = time.time()
        end_time = start_time + self.duration
        
        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            for i in range(self.concurrency):
                executor.submit(self._worker, i)

            # Monitoring loop while running
            while time.time() < end_time:
                elapsed = time.time() - start_time
                remaining = max(0, int(self.duration - elapsed))
                
                with self.lock:
                    reqs = self.total_requests
                    success = self.successful_requests
                    fail = self.failed_requests
                    current_rps = round(reqs / max(0.1, elapsed), 1)
                    avg_lat = round(sum(self.latencies[-50:]) / max(1, len(self.latencies[-50:])), 1) if self.latencies else 0.0

                # Query cluster state
                cluster_info = "fetching..."
                try:
                    m = requests.get(f"{self.target_url}/api/metrics", timeout=1.0).json()
                    cpu = m.get("metrics", {}).get("cpu_utilization", 0)
                    reps = m.get("scaling", {}).get("current_replicas", 1)
                    status = m.get("scaling", {}).get("scaling_status", "Stable")
                    cluster_info = f"CPU: {cpu}% | Replicas: {reps} | Status: {status}"
                except Exception:
                    pass

                sys.stdout.write(f"\r[{remaining:2d}s rem] Reqs: {reqs} | RPS: {current_rps} | Avg Lat: {avg_lat}ms | {cluster_info}   ")
                sys.stdout.flush()
                time.sleep(1.0)

            self.running = False
        
        # Signal load completion
        try:
            requests.post(f"{self.target_url}/api/load/stop", timeout=2.0)
        except Exception:
            pass

        total_elapsed = time.time() - start_time
        print("\n\n" + "=" * 65)
        print(" Load Test Completed — Summary Report")
        print("=" * 65)
        print(f" Total Duration:          {total_elapsed:.1f} seconds")
        print(f" Total Requests:          {self.total_requests}")
        print(f" Successful Requests:     {self.successful_requests}")
        print(f" Failed Requests:         {self.failed_requests}")
        print(f" Throughput:              {self.total_requests / max(0.1, total_elapsed):.1f} req/sec")
        if self.latencies:
            sorted_lat = sorted(self.latencies)
            p50 = sorted_lat[int(len(sorted_lat) * 0.50)]
            p95 = sorted_lat[int(len(sorted_lat) * 0.95)]
            avg = sum(self.latencies) / len(self.latencies)
            print(f" Average Latency:         {avg:.2f} ms")
            print(f" P50 Latency:             {p50:.2f} ms")
            print(f" P95 Latency:             {p95:.2f} ms")
        print("=" * 65 + "\n")

def main():
    parser = argparse.ArgumentParser(description="CloudScale Load Generator")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="Base backend URL")
    parser.add_argument("-c", "--concurrency", type=int, default=15, help="Number of concurrent virtual users")
    parser.add_argument("-d", "--duration", type=int, default=30, help="Test duration in seconds")
    parser.add_argument("-i", "--iterations", type=int, default=25000, help="Compute workload iterations per request")

    args = parser.parse_args()
    tester = LoadTester(args.url, args.concurrency, args.duration, args.iterations)
    tester.run()

if __name__ == "__main__":
    main()
