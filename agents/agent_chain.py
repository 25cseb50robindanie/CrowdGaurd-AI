import os
import json
import logging
from dotenv import load_dotenv
import google.generativeai as genai

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent_chain")

# Load environment variables
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    logger.info("Google Generative AI configured with API key.")
else:
    logger.warning("No GEMINI_API_KEY found in environment. Relying on fallback mechanisms.")

def predict_risk(zone_id: str, person_count: int, density: float, trend: str) -> dict:
    """
    Prediction Agent: Analyzes density and trend to predict risk level and time estimate.
    Returns: {"risk_level": "low"|"medium"|"high", "prediction": "Prediction message"}
    """
    system_instruction = (
        "You are a Crowd Safety Prediction Agent. Your task is to analyze the density and "
        "trend of a specific zone in a crowd-monitored area and predict the safety risk.\n\n"
        "Risk levels criteria:\n"
        "- 'high' risk: Density >= 4.0 or (Density >= 3.0 and Trend is 'rising').\n"
        "- 'medium' risk: Density between 2.0 and 4.0 (exclusive), or (Density >= 1.5 and Trend is 'rising').\n"
        "- 'low' risk: Density < 2.0 with 'stable' or 'falling' trends.\n\n"
        "Your output must be a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"risk_level\": \"high\" | \"medium\" | \"low\",\n"
        "  \"prediction\": \"A short prediction message estimating the time until it becomes unsafe, e.g., 'Gate 4 likely unsafe within 8 minutes' or 'Courtyard expected to remain safe'.\"\n"
        "}"
    )

    prompt = f"Zone: {zone_id}\nPerson Count: {person_count}\nDensity: {density}\nTrend: {trend}"

    if not api_key:
        return _predict_risk_fallback(zone_id, person_count, density, trend, "Missing API Key")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={"response_mime_type": "application/json"},
            system_instruction=system_instruction
        )
        response = model.generate_content(prompt)
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Prediction Agent failed: {e}. Using rule-based fallback.")
        return _predict_risk_fallback(zone_id, person_count, density, trend, str(e))

def _predict_risk_fallback(zone_id: str, person_count: int, density: float, trend: str, reason: str) -> dict:
    # Rule-based fallback for predictability and testing during quota exhaustion
    risk = "low"
    if density >= 4.0 or (density >= 3.0 and trend == "rising"):
        risk = "high"
    elif density >= 2.0 or (density >= 1.5 and trend == "rising"):
        risk = "medium"
        
    time_est = "within 8 minutes" if risk == "high" else "within 20 minutes" if risk == "medium" else "safe"
    pred = f"{zone_id.capitalize()} likely unsafe {time_est}" if risk != "low" else f"{zone_id.capitalize()} expected to remain safe"
    
    return {
        "risk_level": risk,
        "prediction": pred,
        "fallback": True,
        "fallback_reason": reason
    }

def recommend_mitigation(zone_id: str, density: float, trend: str, prediction: str, risk_level: str) -> dict:
    """
    Recommendation Agent: Suggests actionable crowd-control mitigation steps.
    Returns: {"recommendation": "Recommendation message"}
    """
    system_instruction = (
        "You are a Crowd Management Recommendation Agent. Your task is to recommend concrete, "
        "actionable steps to mitigate crowd risks based on the zone metrics and the prediction.\n\n"
        "Output must be a valid JSON object matching this structure:\n"
        "{\n"
        "  \"recommendation\": \"A short, concrete mitigation recommendation (e.g. 'Open Gate 6, redirect incoming queue' or 'Continue normal monitoring'). Keep it highly actionable and under 10 words.\"\n"
        "}"
    )

    prompt = (
        f"Zone: {zone_id}\n"
        f"Density: {density}\n"
        f"Trend: {trend}\n"
        f"Prediction: {prediction}\n"
        f"Risk Level: {risk_level}"
    )

    if not api_key:
        return _recommend_mitigation_fallback(zone_id, density, trend, prediction, risk_level, "Missing API Key")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={"response_mime_type": "application/json"},
            system_instruction=system_instruction
        )
        response = model.generate_content(prompt)
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Recommendation Agent failed: {e}. Using rule-based fallback.")
        return _recommend_mitigation_fallback(zone_id, density, trend, prediction, risk_level, str(e))

def _recommend_mitigation_fallback(zone_id: str, density: float, trend: str, prediction: str, risk_level: str, reason: str) -> dict:
    if risk_level == "high":
        rec = f"Open adjacent gates, redirect incoming queue away from {zone_id}"
    elif risk_level == "medium":
        rec = f"Slow down incoming entry, deploy staff to monitor {zone_id}"
    else:
        rec = "Continue normal monitoring"
    return {"recommendation": rec, "fallback": True, "fallback_reason": reason}

def explain_reasoning(zone_id: str, person_count: int, density: float, trend: str, prediction: str, recommendation: str, risk_level: str) -> dict:
    """
    Explanation Agent: Turns the metrics, prediction, and recommendation into a clear, single-sentence explanation.
    Returns: {"explanation": "Explanation message"}
    """
    system_instruction = (
        "You are a Crowd Safety Explanation Agent. Your task is to explain why the risk level was determined "
        "and why the recommendation is appropriate, in a single clear, plain-language sentence.\n\n"
        "Output must be a valid JSON object matching this structure:\n"
        "{\n"
        "  \"explanation\": \"A single-sentence plain-language explanation of the risk, referencing the metrics (e.g., 'Density rising 2x in the last 60 seconds due to converging inflow' or 'Density remains low and stable under current capacity limits').\"\n"
        "}"
    )

    prompt = (
        f"Zone: {zone_id}\n"
        f"Person Count: {person_count}\n"
        f"Density: {density}\n"
        f"Trend: {trend}\n"
        f"Prediction: {prediction}\n"
        f"Recommendation: {recommendation}\n"
        f"Risk Level: {risk_level}"
    )

    if not api_key:
        return _explain_reasoning_fallback(zone_id, person_count, density, trend, prediction, recommendation, risk_level, "Missing API Key")

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config={"response_mime_type": "application/json"},
            system_instruction=system_instruction
        )
        response = model.generate_content(prompt)
        return json.loads(response.text.strip())
    except Exception as e:
        logger.error(f"Explanation Agent failed: {e}. Using rule-based fallback.")
        return _explain_reasoning_fallback(zone_id, person_count, density, trend, prediction, recommendation, risk_level, str(e))

def _explain_reasoning_fallback(zone_id: str, person_count: int, density: float, trend: str, prediction: str, recommendation: str, risk_level: str, reason: str) -> dict:
    if risk_level == "high":
        exp = f"Density has reached critical level ({density}) with a {trend} trend, requiring immediate flow diversion."
    elif risk_level == "medium":
        exp = f"Moderate crowd build-up detected ({density}) showing a {trend} trend; monitoring is advised."
    else:
        exp = f"Crowd density ({density}) remains low and stable under current limits."
    return {"explanation": exp, "fallback": True, "fallback_reason": reason}

def run_agent_chain(zone_id: str, person_count: int, density: float, trend: str) -> dict:
    """
    Chains the Prediction, Recommendation, and Explanation agents for a single zone.
    Returns a dictionary matching Person B's output contract.
    """
    # 1. Prediction Agent
    pred_res = predict_risk(zone_id, person_count, density, trend)
    risk_level = pred_res.get("risk_level", "low")
    prediction = pred_res.get("prediction", "")

    # 2. Recommendation Agent
    rec_res = recommend_mitigation(zone_id, density, trend, prediction, risk_level)
    recommendation = rec_res.get("recommendation", "")

    # 3. Explanation Agent
    exp_res = explain_reasoning(zone_id, person_count, density, trend, prediction, recommendation, risk_level)
    explanation = exp_res.get("explanation", "")

    return {
        "zone_id": zone_id,
        "risk_level": risk_level,
        "prediction": prediction,
        "recommendation": recommendation,
        "explanation": explanation
    }

if __name__ == "__main__":
    # Self-test when run directly
    print("Testing Agent Chain locally...")
    result = run_agent_chain("gate4", 42, 4.2, "rising")
    print(json.dumps(result, indent=2))
