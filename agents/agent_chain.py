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
if api_key and not api_key.startswith("your_") and not api_key.startswith("AQ."):
    genai.configure(api_key=api_key)
    logger.info("Google Generative AI configured with API key.")
else:
    api_key = None
    logger.warning("No valid GEMINI_API_KEY found in environment. Relying on fallback mechanisms.")

def predict_risk(zone_id: str, person_count: int, density: float, trend: str, 
                 rolling_average: float, growth_rate: float, sustained_congestion_sec: float,
                 speed: float, stagnation_index: float, predicted_risk: str, 
                 time_to_risk: float, prediction_message: str, confidence: float) -> dict:
    """
    Prediction Agent: Interprets the deterministic prediction engine results and confidence scores.
    """
    system_instruction = (
        "You are a Crowd Safety Prediction Agent. Your task is to analyze the density, trend, "
        "rolling average, movement speed, and prediction confidence of a specific zone, and "
        "interpret the deterministic prediction provided to you. Do NOT invent new risk metrics. "
        "Translate the deterministic risk assessment, prediction message, and confidence score into "
        "a professional operator alert warning.\n\n"
        "Your output must be a valid JSON object matching the following structure:\n"
        "{\n"
        "  \"risk_level\": \"high\" | \"medium\" | \"low\",\n"
        "  \"prediction\": \"A professional alert statement detailing the prediction (e.g. 'Platform 1 is at high risk, expected to exceed capacity within 45 seconds with 85% confidence.').\"\n"
        "}"
    )

    prompt = (
        f"Zone: {zone_id}\n"
        f"Person Count: {person_count}\n"
        f"Density: {density}\n"
        f"Trend: {trend}\n"
        f"Rolling Average: {rolling_average}\n"
        f"Growth Rate: {growth_rate} p/s\n"
        f"Sustained Congestion: {sustained_congestion_sec}s\n"
        f"Movement Speed: {speed if speed >= 0 else 'N/A'}\n"
        f"Stagnation Index: {stagnation_index if stagnation_index >= 0 else 'N/A'}\n"
        f"Deterministic Predicted Risk: {predicted_risk}\n"
        f"Deterministic Estimated Time until risk: {time_to_risk} seconds\n"
        f"Deterministic Prediction Message: {prediction_message}\n"
        f"Measured Confidence: {int(confidence * 100)}%"
    )

    if not api_key:
        return _predict_risk_fallback(zone_id, predicted_risk, prediction_message, confidence, "Missing API Key")

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
        return _predict_risk_fallback(zone_id, predicted_risk, prediction_message, confidence, str(e))

def _predict_risk_fallback(zone_id: str, predicted_risk: str, prediction_message: str, confidence: float, reason: str) -> dict:
    return {
        "risk_level": predicted_risk,
        "prediction": f"{zone_id.capitalize()} risk is {predicted_risk.upper()} ({int(confidence * 100)}% confidence). {prediction_message}.",
        "fallback": True,
        "fallback_reason": reason
    }

def recommend_mitigation(zone_id: str, density: float, trend: str, prediction: str, 
                         risk_level: str, growth_rate: float, sustained_congestion_sec: float,
                         speed: float, stagnation_index: float, confidence: float) -> dict:
    """
    Recommendation Agent: Suggests actionable crowd-control mitigation steps based on all metrics.
    """
    system_instruction = (
        "You are a Crowd Management Recommendation Agent. Your task is to recommend concrete, "
        "actionable steps to mitigate crowd risks based on the zone metrics, trend, growth rate, "
        "sustained congestion, speed, stagnation, and safety prediction. Recommend operations under 10 words.\n\n"
        "Output must be a valid JSON object matching this structure:\n"
        "{\n"
        "  \"recommendation\": \"A short, concrete mitigation recommendation (e.g. 'Open Gate 6, redirect incoming queue' or 'Continue normal monitoring').\"\n"
        "}"
    )

    prompt = (
        f"Zone: {zone_id}\n"
        f"Density: {density}\n"
        f"Trend: {trend}\n"
        f"Growth Rate: {growth_rate} p/s\n"
        f"Sustained Congestion: {sustained_congestion_sec}s\n"
        f"Movement Speed: {speed if speed >= 0 else 'N/A'}\n"
        f"Stagnation Index: {stagnation_index if stagnation_index >= 0 else 'N/A'}\n"
        f"Prediction: {prediction}\n"
        f"Risk Level: {risk_level}\n"
        f"Confidence: {int(confidence * 100)}%"
    )

    if not api_key:
        return _recommend_mitigation_fallback(zone_id, risk_level, "Missing API Key")

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
        return _recommend_mitigation_fallback(zone_id, risk_level, str(e))

def _recommend_mitigation_fallback(zone_id: str, risk_level: str, reason: str) -> dict:
    if risk_level == "high":
        rec = f"Open adjacent exits, redirect incoming passengers away from {zone_id}"
    elif risk_level == "medium":
        rec = f"Slow down incoming flow, deploy staff to monitor {zone_id}"
    else:
        rec = "Continue normal monitoring"
    return {"recommendation": rec, "fallback": True, "fallback_reason": reason}

def explain_reasoning(zone_id: str, person_count: int, density: float, trend: str, 
                      prediction: str, recommendation: str, risk_level: str,
                      rolling_average: float, growth_rate: float, sustained_congestion_sec: float,
                      speed: float, stagnation_index: float, confidence: float) -> dict:
    """
    Explanation Agent: Turns the metrics, prediction, and recommendation into a clear, single-sentence explanation.
    """
    system_instruction = (
        "You are a Crowd Safety Explanation Agent. Your task is to explain why the risk level was determined "
        "and why the recommendation is appropriate, in a single clear, plain-language sentence. You MUST cite "
        "the actual computed metrics (person count, density, growth rate, rolling average, speed/stagnation) "
        "as evidence. Be detailed and quantitative rather than generic. Citing percentages and rates is highly encouraged.\n\n"
        "Good Example:\n"
        "'Passenger inflow increased by 42% during the last 30 seconds while movement speed dropped below the congestion threshold of 30 px/s. At the current growth rate, the platform is expected to exceed safe capacity in approximately 95 seconds.'\n\n"
        "Output must be a valid JSON object matching this structure:\n"
        "{\n"
        "  \"explanation\": \"A single-sentence plain-language explanation of the risk, citing metrics (e.g. 'Density is high at 4.2 with stagnant flow of 12 px/s, requiring flow diversion with 90% confidence.').\"\n"
        "}"
    )

    prompt = (
        f"Zone: {zone_id}\n"
        f"Person Count: {person_count}\n"
        f"Density: {density}\n"
        f"Trend: {trend}\n"
        f"Rolling Average: {rolling_average}\n"
        f"Growth Rate: {growth_rate} p/s\n"
        f"Sustained Congestion: {sustained_congestion_sec}s\n"
        f"Speed: {speed if speed >= 0 else 'N/A'}\n"
        f"Stagnation Index: {stagnation_index if stagnation_index >= 0 else 'N/A'}\n"
        f"Prediction: {prediction}\n"
        f"Recommendation: {recommendation}\n"
        f"Risk Level: {risk_level}\n"
        f"Confidence: {int(confidence * 100)}%"
    )

    if not api_key:
        return _explain_reasoning_fallback(zone_id, density, trend, growth_rate, speed, risk_level, confidence, "Missing API Key")

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
        return _explain_reasoning_fallback(zone_id, density, trend, growth_rate, speed, risk_level, confidence, str(e))

def _explain_reasoning_fallback(zone_id: str, density: float, trend: str, growth_rate: float, 
                                speed: float, risk_level: str, confidence: float, reason: str) -> dict:
    speed_desc = f" while movement speed dropped to {speed:.1f} px/s" if speed >= 0 else ""
    growth_desc = f"crowd growth rate of {growth_rate:+.2f} people/sec" if growth_rate != 0 else "stable crowd flow"
    
    if risk_level == "high":
        exp = (f"Platform {zone_id.capitalize()} is at high risk because crowd density reached {density:.2f} "
               f"with a {trend} trend and {growth_desc}{speed_desc}. Emergency flow diversion is recommended "
               f"({int(confidence*100)}% confidence).")
    elif risk_level == "medium":
        exp = (f"Platform {zone_id.capitalize()} is at medium risk as crowd density reached {density:.2f} "
               f"with a {trend} trend ({growth_desc}). Deploy staff to monitor flow and control gates "
               f"({int(confidence*100)}% confidence).")
    else:
        exp = (f"Platform {zone_id.capitalize()} crowd density ({density:.2f}) remains low and stable under current limits, "
               f"with normal walking speed of {speed:.1f} px/s if active ({int(confidence*100)}% confidence).")
    return {"explanation": exp, "fallback": True, "fallback_reason": reason}

def run_agent_chain(zone_id: str, person_count: int, density: float, trend: str,
                    rolling_average: float, growth_rate: float, sustained_congestion_sec: float,
                    speed: float, stagnation_index: float, predicted_risk: str,
                    time_to_risk: float, prediction_message: str, confidence: float) -> dict:
    """
    Chains the Prediction, Recommendation, and Explanation agents for a single zone.
    """
    # 1. Prediction Agent
    pred_res = predict_risk(
        zone_id=zone_id,
        person_count=person_count,
        density=density,
        trend=trend,
        rolling_average=rolling_average,
        growth_rate=growth_rate,
        sustained_congestion_sec=sustained_congestion_sec,
        speed=speed,
        stagnation_index=stagnation_index,
        predicted_risk=predicted_risk,
        time_to_risk=time_to_risk,
        prediction_message=prediction_message,
        confidence=confidence
    )
    if not isinstance(pred_res, dict):
        pred_res = {}
    risk_level = pred_res.get("risk_level", predicted_risk)
    prediction = pred_res.get("prediction", "")

    # 2. Recommendation Agent
    rec_res = recommend_mitigation(
        zone_id=zone_id,
        density=density,
        trend=trend,
        prediction=prediction,
        risk_level=risk_level,
        growth_rate=growth_rate,
        sustained_congestion_sec=sustained_congestion_sec,
        speed=speed,
        stagnation_index=stagnation_index,
        confidence=confidence
    )
    if not isinstance(rec_res, dict):
        rec_res = {}
    recommendation = rec_res.get("recommendation", "")

    # 3. Explanation Agent
    exp_res = explain_reasoning(
        zone_id=zone_id,
        person_count=person_count,
        density=density,
        trend=trend,
        prediction=prediction,
        recommendation=recommendation,
        risk_level=risk_level,
        rolling_average=rolling_average,
        growth_rate=growth_rate,
        sustained_congestion_sec=sustained_congestion_sec,
        speed=speed,
        stagnation_index=stagnation_index,
        confidence=confidence
    )
    if not isinstance(exp_res, dict):
        exp_res = {}
    explanation = exp_res.get("explanation", "")

    return {
        "zone_id": zone_id,
        "risk_level": risk_level,
        "prediction": prediction,
        "recommendation": recommendation,
        "explanation": explanation
    }

def summarize_memories(memories: list) -> str:
    """
    Summarizes a list of retrieved similar incident memories using Gemini.
    """
    if not api_key:
        logger.warning("GEMINI_API_KEY is not configured. Skipping summarization.")
        return ""
    
    if not memories:
        return ""

    memories_str = ""
    for i, mem in enumerate(memories):
        memories_str += (
            f"Incident {i+1}:\n"
            f"- Date: {mem.get('date')}\n"
            f"- Risk Level: {mem.get('risk_level')}\n"
            f"- Action Taken: {mem.get('action_taken')}\n"
            f"- Operator Notes: {mem.get('operator_notes')}\n"
            f"- Outcome: {mem.get('outcome')}\n\n"
        )

    system_instruction = (
        "You are assisting a command center operator.\n\n"
        "Based on these previous incidents, summarize the most relevant operational insight in 2-3 sentences.\n\n"
        "Mention:\n"
        "- common response\n"
        "- whether it worked\n"
        "- anything the operator should know\n\n"
        "Do not invent information that is not present."
    )

    prompt = f"Previous Similar Incidents:\n\n{memories_str}"

    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_instruction
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini memory summarization failed: {e}")
        return ""

if __name__ == "__main__":
    print("Testing Agent Chain locally...")
    result = run_agent_chain("gate4", 30, 4.2, "rising", 25.5, 1.2, 5.0, 15.2, 1.0, "high", 10.0, "Likely unsafe in 10s", 0.85)
    print(json.dumps(result, indent=2))

