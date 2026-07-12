import os
import time
import logging
from typing import Dict, Any

from app.ai.llm_client import llm_client
from app.api.v1.schemas.regulation import RegulatoryIntelligenceOutput
from app.core.exceptions import LLMConfigurationError

logger = logging.getLogger("arex.regulatory-intelligence-agent")

def run_regulatory_intelligence(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph agent node that classifies incoming regulation update text.
    Assesses relevance, urgency, category, and affected business areas.
    """
    from app.core.profiler import RequestProfiler
    RequestProfiler.reset()
    t_start = time.time()

    logger.info("Executing Regulatory Intelligence Agent...")
    
    raw_content = state.get("raw_content", "")
    if not raw_content:
        logger.error("No regulation raw_content found in graph state.")
        ret = {
            "relevant": False,
            "category": "other",
            "urgency": "low",
            "affected_business_areas": [],
            "rationale": "No raw content provided."
        }
        RequestProfiler.log_metric("total_time", time.time() - t_start)
        RequestProfiler.print_summary("Regulatory Intelligence Agent")
        return ret

    # Load system prompt
    t_prompt_start = time.time()
    current_dir = os.path.dirname(os.path.abspath(__file__))
    prompt_path = os.path.join(current_dir, "../prompts/regulatory_intelligence.md")
    
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception as e:
        logger.error(f"Failed to read prompt markdown: {e}")
        system_prompt = (
            "You are a GxP regulatory compliance expert. Classify the regulation "
            "into 'relevant' (true/false), category, urgency, affected_business_areas, and rationale."
        )
    RequestProfiler.log_metric("prompt_construction_time", time.time() - t_prompt_start)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Please analyze this FDA regulation update:\n\n{raw_content}"}
    ]

    try:
        logger.info(
            f"[RegulatoryIntelligenceAgent] Calling LLM | "
            f"mode={'online' if not llm_client.is_offline_mode() else 'offline'} | "
            f"content_length={len(raw_content)}"
        )
        t_llm = time.time()
        # Call LLM client with validation model
        result: RegulatoryIntelligenceOutput = llm_client.get_completion(
            messages=messages,
            response_model=RegulatoryIntelligenceOutput,
            temperature=0.0
        )
        logger.info(f"[Timing] Regulatory intelligence LLM call completed in {time.time() - t_llm:.2f}s")
        
        logger.info(
            f"Regulatory Intelligence Verdict: Relevant={result.relevant} | Urgency={result.urgency}"
        )
        
        ret = {
            "relevant": result.relevant,
            "category": result.category,
            "urgency": result.urgency,
            "affected_business_areas": result.affected_business_areas,
            "rationale": result.rationale
        }
        RequestProfiler.log_metric("total_time", time.time() - t_start)
        RequestProfiler.print_summary("Regulatory Intelligence Agent")
        return ret
    except LLMConfigurationError:
        raise
    except Exception as e:
        logger.error(f"LLM call failed or parsed invalid response schema: {e}. Falling back to default.")
        ret = {
            "relevant": False,
            "category": "other",
            "urgency": "low",
            "affected_business_areas": [],
            "rationale": f"Analysis failed due to error: {str(e)}"
        }
        RequestProfiler.log_metric("total_time", time.time() - t_start)
        RequestProfiler.print_summary("Regulatory Intelligence Agent")
        return ret
