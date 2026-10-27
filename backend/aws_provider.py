import os
import sys
import time
import re
import uuid
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
import boto3
import requests

# Default configuration from environment variables
DEFAULT_AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1").strip()
DEFAULT_ASG_NAME = os.environ.get("ASG_NAME", "cloudscale-asg").strip()
DEFAULT_ALB_ARN_SUFFIX = os.environ.get("ALB_ARN_SUFFIX", "app/cloudscale-alb/6bc712f66631aff2").strip()
DEFAULT_ALB_URL = os.environ.get("ALB_URL", "http://cloudscale-alb-1352438602.ap-south-1.elb.amazonaws.com").strip().rstrip('/')


class AWSProvider:
    """
    AWS Provider that reads LIVE AWS data with boto3:
      1. ASG & EC2 instances
      2. CloudWatch CPUUtilization for ASG
      3. ALB RequestCount and TargetResponseTime (Average & p95)
      4. Scaling activities mapped to scaling event audit format
    Maintains a 20-second cache to prevent spamming the AWS APIs during frontend polling.
    Gracefully handles API errors by preserving the last known good state and logging error details.
    """

    def __init__(
        self,
        region: Optional[str] = None,
        asg_name: Optional[str] = None,
        alb_arn_suffix: Optional[str] = None,
        alb_url: Optional[str] = None,
        cache_ttl: int = 20
    ):
        self.region = region or DEFAULT_AWS_REGION
        self.asg_name = asg_name or DEFAULT_ASG_NAME
        self.alb_arn_suffix = alb_arn_suffix or DEFAULT_ALB_ARN_SUFFIX
        self.alb_url = (alb_url or DEFAULT_ALB_URL).rstrip('/')
        self.cache_ttl = cache_ttl

        # Boto3 clients (using default AWS CLI credentials)
        self.asg_client = boto3.client("autoscaling", region_name=self.region)
        self.ec2_client = boto3.client("ec2", region_name=self.region)
        self.cw_client = boto3.client("cloudwatch", region_name=self.region)

        # Thread safety & cache state
        self._lock = threading.Lock()
        self._last_refresh = 0.0
        self._last_error: Optional[str] = None

        # Cached telemetry and state
        self._cached_asg: Dict[str, Any] = {}
        self._cached_instances: List[Dict[str, Any]] = []
        self._cached_metrics: Dict[str, Any] = {
            "cpu_utilization": 0.0,
            "requests_per_second": 0.0,
            "average_latency_ms": 0.0,
            "p95_latency_ms": 0.0,
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "active_synthetic_load": 0.0
        }
        self._cached_history: List[Dict[str, Any]] = []
        self._cached_events: List[Dict[str, Any]] = []
        self._cached_scaling_status: Dict[str, Any] = {
            "current_replicas": 1,
            "min_replicas": 1,
            "max_replicas": 4,
            "scaling_status": "Stable",
            "in_cooldown": False,
            "cooldown_remaining": 0,
            "mode": "aws",
            "is_simulated": False,
            "total_events": 0
        }
        self._cached_scaling_config: Dict[str, Any] = {
            "min_replicas": 1,
            "max_replicas": 4,
            "scale_out_threshold": 60.0,
            "scale_in_threshold": 25.0,
            "cooldown_seconds": 300,
            "mode": "aws",
            "is_simulated": False
        }

        # Perform initial fetch
        self.refresh(force=True)

    def refresh(self, force: bool = False) -> None:
        """Fetch fresh live data from AWS if cache has expired or forced."""
        now = time.time()
        if not force and (now - self._last_refresh < self.cache_ttl):
            return

        with self._lock:
            # Double-check inside lock
            now = time.time()
            if not force and (now - self._last_refresh < self.cache_ttl):
                return

            try:
                self._fetch_from_aws()
                self._last_refresh = now
                self._last_error = None
            except Exception as e:
                self._last_error = str(e)
                print(f"[AWSProvider] Error refreshing live AWS data: {e}", file=sys.stderr)

    def _fetch_from_aws(self) -> None:
        # 1. ASG & EC2 instances
        asg_resp = self.asg_client.describe_auto_scaling_groups(
            AutoScalingGroupNames=[self.asg_name]
        )
        asg_groups = asg_resp.get("AutoScalingGroups", [])
        asg_data = asg_groups[0] if asg_groups else {}
        self._cached_asg = asg_data

        asg_instances = asg_data.get("Instances", [])
        desired_capacity = asg_data.get("DesiredCapacity", 1)
        min_size = asg_data.get("MinSize", 1)
        max_size = asg_data.get("MaxSize", 4)
        default_cooldown = asg_data.get("DefaultCooldown", 300)

        # Describe EC2 instances for per-instance details (state, IP, launch time)
        ec2_instances_by_id: Dict[str, Dict[str, Any]] = {}
        if asg_instances:
            inst_ids = [inst["InstanceId"] for inst in asg_instances if "InstanceId" in inst]
            if inst_ids:
                try:
                    ec2_resp = self.ec2_client.describe_instances(InstanceIds=inst_ids)
                    for reservation in ec2_resp.get("Reservations", []):
                        for ec2_inst in reservation.get("Instances", []):
                            ec2_instances_by_id[ec2_inst["InstanceId"]] = ec2_inst
                except Exception as ec2_err:
                    print(f"[AWSProvider] Error describing EC2 instances: {ec2_err}", file=sys.stderr)

        instances_list: List[Dict[str, Any]] = []
        now_utc = datetime.now(timezone.utc)
        for idx, asg_inst in enumerate(asg_instances):
            inst_id = asg_inst.get("InstanceId", f"i-aws-{idx}")
            ec2_inst = ec2_instances_by_id.get(inst_id, {})

            state_obj = ec2_inst.get("State", {})
            state_name = state_obj.get("Name")
            status = state_name.capitalize() if state_name else asg_inst.get("LifecycleState", "InService")

            ip = ec2_inst.get("PrivateIpAddress") or ec2_inst.get("PublicIpAddress") or "127.0.0.1"
            launch_time = ec2_inst.get("LaunchTime") or asg_inst.get("LaunchTime")
            uptime_seconds = 0
            if launch_time and isinstance(launch_time, datetime):
                uptime_seconds = max(0, int((now_utc - launch_time).total_seconds()))

            # Instance Name Tag if present
            name = f"aws-ec2-{inst_id[-8:]}"
            for tag in ec2_inst.get("Tags", []):
                if tag.get("Key") == "Name" and tag.get("Value"):
                    name = tag.get("Value")
                    break

            instances_list.append({
                "id": inst_id,
                "name": name,
                "status": status,
                "ip": ip,
                "port": 5000,
                "uptime_seconds": uptime_seconds,
                "cpu_percent": 0.0,  # Updated after CloudWatch fetch
                "memory_mb": 1024,
                "requests_served": 0,
                "is_simulated": False,
                "role": "EC2 ASG Worker",
                "availability_zone": asg_inst.get("AvailabilityZone", self.region),
                "lifecycle_state": asg_inst.get("LifecycleState", "InService"),
                "health_status": asg_inst.get("HealthStatus", "Healthy"),
                "instance_type": asg_inst.get("InstanceType", ec2_inst.get("InstanceType", "t3.micro")),
                "launch_time": launch_time.isoformat() if launch_time else None
            })

        # 2. CloudWatch get_metric_data (last 30 minutes, 60s period)
        start_time = now_utc - timedelta(minutes=30)
        cw_queries = [
            {
                "Id": "cpu",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/EC2",
                        "MetricName": "CPUUtilization",
                        "Dimensions": [{"Name": "AutoScalingGroupName", "Value": self.asg_name}]
                    },
                    "Period": 60,
                    "Stat": "Average"
                },
                "ReturnData": True
            },
            {
                "Id": "requests",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/ApplicationELB",
                        "MetricName": "RequestCount",
                        "Dimensions": [{"Name": "LoadBalancer", "Value": self.alb_arn_suffix}]
                    },
                    "Period": 60,
                    "Stat": "Sum"
                },
                "ReturnData": True
            },
            {
                "Id": "latency_avg",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/ApplicationELB",
                        "MetricName": "TargetResponseTime",
                        "Dimensions": [{"Name": "LoadBalancer", "Value": self.alb_arn_suffix}]
                    },
                    "Period": 60,
                    "Stat": "Average"
                },
                "ReturnData": True
            },
            {
                "Id": "latency_p95",
                "MetricStat": {
                    "Metric": {
                        "Namespace": "AWS/ApplicationELB",
                        "MetricName": "TargetResponseTime",
                        "Dimensions": [{"Name": "LoadBalancer", "Value": self.alb_arn_suffix}]
                    },
                    "Period": 60,
                    "Stat": "p95"
                },
                "ReturnData": True
            }
        ]

        cw_resp = self.cw_client.get_metric_data(
            MetricDataQueries=cw_queries,
            StartTime=start_time,
            EndTime=now_utc,
            ScanBy="TimestampAscending"
        )
        metric_results = {r["Id"]: r for r in cw_resp.get("MetricDataResults", [])}

        # CPU Utilization
        cpu_res = metric_results.get("cpu", {})
        cpu_vals = cpu_res.get("Values", [])
        current_cpu = round(float(cpu_vals[-1]), 1) if cpu_vals else 0.0

        # Request Count & Throughput
        req_res = metric_results.get("requests", {})
        req_vals = req_res.get("Values", [])
        total_requests = int(sum(req_vals)) if req_vals else 0
        latest_req = req_vals[-1] if req_vals else 0.0
        current_rps = round(float(latest_req) / 60.0, 1)

        # ALB Latency (Reported in seconds -> convert to ms)
        lat_avg_res = metric_results.get("latency_avg", {})
        lat_avg_vals = lat_avg_res.get("Values", [])
        current_lat_avg = round(float(lat_avg_vals[-1]) * 1000.0, 1) if lat_avg_vals else 0.0

        lat_p95_res = metric_results.get("latency_p95", {})
        lat_p95_vals = lat_p95_res.get("Values", [])
        current_lat_p95 = round(float(lat_p95_vals[-1]) * 1000.0, 1) if lat_p95_vals else current_lat_avg

        # Update per-instance CPU
        for inst in instances_list:
            inst["cpu_percent"] = current_cpu

        self._cached_instances = instances_list
        self._cached_metrics = {
            "cpu_utilization": current_cpu,
            "requests_per_second": current_rps,
            "average_latency_ms": current_lat_avg,
            "p95_latency_ms": current_lat_p95,
            "total_requests": total_requests,
            "successful_requests": total_requests,
            "failed_requests": 0,
            "active_synthetic_load": 0.0
        }

        # Build time-series history aligned across 60s buckets
        timeline: Dict[int, Dict[str, Any]] = {}
        for ts, val in zip(cpu_res.get("Timestamps", []), cpu_res.get("Values", [])):
            bucket = int(ts.timestamp()) // 60 * 60
            timeline.setdefault(bucket, {})["cpu"] = round(float(val), 1)
            timeline[bucket]["dt"] = ts

        for ts, val in zip(req_res.get("Timestamps", []), req_res.get("Values", [])):
            bucket = int(ts.timestamp()) // 60 * 60
            timeline.setdefault(bucket, {})["rps"] = round(float(val) / 60.0, 1)
            if "dt" not in timeline[bucket]:
                timeline[bucket]["dt"] = ts

        for ts, val in zip(lat_avg_res.get("Timestamps", []), lat_avg_res.get("Values", [])):
            bucket = int(ts.timestamp()) // 60 * 60
            timeline.setdefault(bucket, {})["latency_ms"] = round(float(val) * 1000.0, 1)
            if "dt" not in timeline[bucket]:
                timeline[bucket]["dt"] = ts

        history_pts: List[Dict[str, Any]] = []
        for bucket in sorted(timeline.keys()):
            item = timeline[bucket]
            dt = item.get("dt")
            time_str = dt.astimezone().strftime("%H:%M:%S") if dt else datetime.fromtimestamp(bucket).strftime("%H:%M:%S")
            history_pts.append({
                "time": time_str,
                "timestamp": bucket,
                "cpu": item.get("cpu", current_cpu),
                "replicas": len(instances_list) or desired_capacity,
                "rps": item.get("rps", 0.0),
                "latency_ms": item.get("latency_ms", 0.0)
            })

        self._cached_history = history_pts

        # 3. Scaling Activities mapped to scaling event log
        act_resp = self.asg_client.describe_scaling_activities(
            AutoScalingGroupName=self.asg_name,
            MaxRecords=40
        )
        events_list: List[Dict[str, Any]] = []
        for act in act_resp.get("Activities", []):
            act_id = act.get("ActivityId", f"evt-{uuid.uuid4().hex[:8]}")
            start_ts = act.get("StartTime")
            if isinstance(start_ts, datetime):
                ts_str = start_ts.astimezone().strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = str(start_ts)

            desc = act.get("Description", "")
            cause = act.get("Cause", "")
            status_msg = act.get("StatusMessage", "")
            combined_txt = f"{desc} {cause}".lower()

            if "terminat" in combined_txt or "decrease" in combined_txt or "stopped" in combined_txt:
                action = "SCALE_IN"
            else:
                action = "SCALE_OUT"

            # Parse from -> to replicas from cause text if possible
            prev_rep = 1
            new_rep = 1
            m = re.search(r"from\s+(\d+)\s+to\s+(\d+)", cause, re.IGNORECASE)
            if m:
                prev_rep = int(m.group(1))
                new_rep = int(m.group(2))
            elif action == "SCALE_OUT":
                prev_rep = max(1, len(instances_list) - 1)
                new_rep = len(instances_list)
            else:
                prev_rep = len(instances_list) + 1
                new_rep = len(instances_list)

            events_list.append({
                "id": act_id,
                "timestamp": ts_str,
                "action": action,
                "previous_replicas": prev_rep,
                "new_replicas": new_rep,
                "measured_cpu": current_cpu,
                "reason": cause or desc or status_msg or "AWS Auto Scaling Activity",
                "mode": "AWS Auto Scaling Group"
            })

        self._cached_events = events_list

        # 4. Scaling status & policy config
        scaling_status_str = "Stable"
        for inst in instances_list:
            ls = (inst.get("lifecycle_state") or "").lower()
            if "pending" in ls or "launching" in ls:
                scaling_status_str = "Scaling Out Active"
                break
            elif "terminat" in ls:
                scaling_status_str = "Scaling In Active"
                break

        current_rep_count = len(instances_list) if instances_list else desired_capacity
        self._cached_scaling_status = {
            "current_replicas": current_rep_count,
            "min_replicas": min_size,
            "max_replicas": max_size,
            "scaling_status": scaling_status_str,
            "in_cooldown": False,
            "cooldown_remaining": 0,
            "mode": "aws",
            "is_simulated": False,
            "total_events": len(events_list)
        }

        self._cached_scaling_config = {
            "min_replicas": min_size,
            "max_replicas": max_size,
            "scale_out_threshold": 60.0,
            "scale_in_threshold": 25.0,
            "cooldown_seconds": default_cooldown,
            "mode": "aws",
            "is_simulated": False
        }

    # Public getters with automatic cache refresh
    def get_instances(self) -> List[Dict[str, Any]]:
        self.refresh()
        return list(self._cached_instances)

    def get_metrics(self) -> Dict[str, Any]:
        self.refresh()
        return dict(self._cached_metrics)

    def get_history(self) -> List[Dict[str, Any]]:
        self.refresh()
        return list(self._cached_history)

    def get_events(self) -> List[Dict[str, Any]]:
        self.refresh()
        return list(self._cached_events)

    def clear_events(self) -> None:
        with self._lock:
            self._cached_events.clear()

    def get_scaling_status(self) -> Dict[str, Any]:
        self.refresh()
        return dict(self._cached_scaling_status)

    def get_scaling_config(self) -> Dict[str, Any]:
        self.refresh()
        return dict(self._cached_scaling_config)

    def get_last_error(self) -> Optional[str]:
        return self._last_error


class AWSLoadGenerator:
    """
    Load Generator for AWS mode:
    Spawns worker threads that send REAL HTTP GET requests to ALB_URL + "/compute".
    Supports concurrency, duration, and intensity parameters matching the existing load generator API.
    """

    def __init__(self, alb_url: Optional[str] = None):
        self.alb_url = (alb_url or DEFAULT_ALB_URL).rstrip('/')
        self.lock = threading.Lock()

        self.is_active = False
        self.concurrency = 20
        self.duration_seconds = 45
        self.start_time = 0.0
        self.end_time = 0.0
        self.target_intensity = "high"

        self._worker_threads: List[threading.Thread] = []
        self._stop_event = threading.Event()

    def start(self, concurrency: int = 20, duration_seconds: int = 45, intensity: str = "high") -> Dict[str, Any]:
        with self.lock:
            # Stop existing workers if any
            self._stop_event.set()
            for t in self._worker_threads:
                if t.is_alive():
                    t.join(timeout=0.2)
            self._worker_threads.clear()
            self._stop_event.clear()

            self.concurrency = max(1, int(concurrency))
            self.duration_seconds = max(5, int(duration_seconds))
            self.target_intensity = intensity.lower()
            self.is_active = True
            self.start_time = time.time()
            self.end_time = self.start_time + self.duration_seconds

            intensity_to_iterations = {
                "low": 15000,
                "medium": 35000,
                "high": 75000,
                "stress": 120000
            }
            iterations = intensity_to_iterations.get(self.target_intensity, 75000)

            # Spawn real HTTP worker threads
            for i in range(self.concurrency):
                thread = threading.Thread(
                    target=self._worker_loop,
                    args=(iterations,),
                    daemon=True,
                    name=f"aws-load-worker-{i+1}"
                )
                self._worker_threads.append(thread)
                thread.start()

        return self.get_status()

    def stop(self) -> Dict[str, Any]:
        with self.lock:
            self._stop_event.set()
            self.is_active = False
        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            now = time.time()
            if self.is_active and (now >= self.end_time or self._stop_event.is_set()):
                self.is_active = False
                self._stop_event.set()

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

    def _worker_loop(self, iterations: int) -> None:
        """Worker thread loop sending real HTTP requests to the Application Load Balancer."""
        target_url = f"{self.alb_url}/compute?iterations={iterations}"
        session = requests.Session()

        while not self._stop_event.is_set():
            if time.time() >= self.end_time:
                break
            try:
                # Dispatch real compute request to ALB
                session.get(target_url, timeout=6.0)
            except Exception:
                # Suppress connection/timeout errors during heavy load test
                pass
            # Slight yield to distribute throughput
            time.sleep(0.05)

        session.close()
        with self.lock:
            if time.time() >= self.end_time:
                self.is_active = False
