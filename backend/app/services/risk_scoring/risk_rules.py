import logging

logger = logging.getLogger("arex.risk-rules")

def calculate_risk_score(urgency: str, category: str, affected_departments_count: int) -> dict:
    """
    Computes deterministic risk score and impact level based on GxP rules:
    Risk Score = Urgency Multiplier * Department Factor * Category Multiplier
    
    Urgency Multiplier: Low=1, Medium=2, High=3, Critical=4
    Department Factor: count of affected business departments (1 to 5)
    Category Multiplier: "records"=1.2, "validation"=1.5, "signatures"=1.8, "other"=1.0
    
    Final Risk Rank: Score < 3 (Low), 3-6 (Medium), > 6 (High)
    """
    urgency_lower = urgency.lower().strip()
    urgency_multipliers = {
        "low": 1.0,
        "medium": 2.0,
        "high": 3.0,
        "critical": 4.0
    }
    urgency_mult = urgency_multipliers.get(urgency_lower, 1.0)
    
    # Department Factor is count of affected departments bounded [1, 5]
    dept_factor = float(max(1, min(affected_departments_count, 5)))
    
    category_lower = category.lower().strip()
    category_multipliers = {
        "records": 1.2,
        "validation": 1.5,
        "signatures": 1.8,
        "other": 1.0
    }
    cat_mult = category_multipliers.get(category_lower, 1.0)
    
    score = urgency_mult * dept_factor * cat_mult
    
    # Classify impact level
    if score < 3.0:
        impact_level = "Low"
    elif score <= 6.0:
        impact_level = "Medium"
    else:
        impact_level = "High"
        
    logger.info(
        f"Deterministic Risk Calculation: Urgency={urgency} (x{urgency_mult}) | "
        f"Depts={affected_departments_count} (x{dept_factor}) | "
        f"Category={category} (x{cat_mult}) | "
        f"Result Score={score:.2f} | Level={impact_level}"
    )
    
    return {
        "risk_score": round(score, 2),
        "impact_level": impact_level
    }
