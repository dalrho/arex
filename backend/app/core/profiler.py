import threading
import time
import logging
from typing import Any, Optional

logger = logging.getLogger("arex.profiler")

class RequestProfiler:
    _local = threading.local()

    @classmethod
    def get_metrics(cls) -> dict:
        if not hasattr(cls._local, "metrics"):
            cls.reset()
        return cls._local.metrics

    @classmethod
    def reset(cls):
        cls._local.metrics = {
            "prompt_construction_time": 0.0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "embedding_time": 0.0,
            "qdrant_retrieval_time": 0.0,
            "retrieved_chunks_count": 0,
            "llm_inference_time": 0.0,
            "json_validation_time": 0.0,
            "database_write_time": 0.0,
            "total_time": 0.0,
        }

    @classmethod
    def log_metric(cls, name: str, value: Any):
        metrics = cls.get_metrics()
        if name in metrics:
            if isinstance(metrics[name], float):
                metrics[name] += float(value)
            elif isinstance(metrics[name], int):
                metrics[name] += int(value)
        else:
            metrics[name] = value

    @classmethod
    def print_summary(cls, agent_name: str):
        metrics = cls.get_metrics()
        logger.info(f"\n=== PROFILER REPORT FOR AGENT: {agent_name} ===")
        logger.info(f"  * Prompt Construction Time : {metrics.get('prompt_construction_time', 0.0):.4f}s")
        logger.info(f"  * Prompt Token Count       : {metrics.get('prompt_tokens', 0)}")
        logger.info(f"  * Completion Token Count   : {metrics.get('completion_tokens', 0)}")
        logger.info(f"  * Embedding Time           : {metrics.get('embedding_time', 0.0):.4f}s")
        logger.info(f"  * Qdrant Retrieval Time    : {metrics.get('qdrant_retrieval_time', 0.0):.4f}s")
        logger.info(f"  * Retrieved Chunks Count   : {metrics.get('retrieved_chunks_count', 0)}")
        logger.info(f"  * LLM Inference Time       : {metrics.get('llm_inference_time', 0.0):.4f}s")
        logger.info(f"  * JSON Validation Time     : {metrics.get('json_validation_time', 0.0):.4f}s")
        logger.info(f"  * Database Write Time      : {metrics.get('database_write_time', 0.0):.4f}s")
        logger.info(f"  * Total Time               : {metrics.get('total_time', 0.0):.4f}s")
        logger.info("==============================================")
