import os
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Setup logging
logger = logging.getLogger("agents_memory")

# Load environment variables
load_dotenv()

MEM0_API_KEY = os.getenv("MEM0_API_KEY")
client = None

if MEM0_API_KEY and not MEM0_API_KEY.startswith("your_"):
    try:
        from mem0 import MemoryClient
        client = MemoryClient(api_key=MEM0_API_KEY)
        logger.info("Mem0 MemoryClient initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Mem0 MemoryClient: {e}")
else:
    logger.warning("MEM0_API_KEY not found or invalid in environment. Mem0 memory features will run in mock/no-op mode.")

def save_incident(
    incident_id: str,
    zone_id: str,
    zone_name: str,
    timestamp: str,
    crowd_count: int,
    density_score: float,
    risk_level: str,
    ai_recommendation: str,
    actual_dispatched_response: str,
    operator_notes: str,
    final_outcome: str = "Dispatched"
) -> bool:
    """
    Saves the complete incident context to Mem0 as a conversation.
    Uses the zone_id (location) as user_id.
    """
    if not client:
        logger.warning("Mem0 client not initialized. Skipping save_incident.")
        return False

    # Normalize user_id (zone/location)
    user_id = zone_id.lower().replace(" ", "_")

    user_content = (
        f"Incident ID: {incident_id}\n"
        f"Zone: {zone_name}\n"
        f"Zone ID: {zone_id}\n"
        f"Crowd Count: {crowd_count}\n"
        f"Density Score: {density_score:.2f}\n"
        f"Risk Level: {risk_level}\n"
        f"Timestamp: {timestamp}"
    )

    assistant_content = (
        f"Dispatch recommendation: {ai_recommendation}\n"
        f"Actual dispatched response: {actual_dispatched_response}\n"
        f"Operator notes: {operator_notes}\n"
        f"Final outcome: {final_outcome}"
    )

    messages = [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_content}
    ]

    metadata = {
        "incident_id": incident_id,
        "zone_id": zone_id,
        "zone_name": zone_name,
        "timestamp": timestamp,
        "crowd_count": crowd_count,
        "density_score": density_score,
        "risk_level": risk_level,
        "ai_recommendation": ai_recommendation,
        "actual_dispatched_response": actual_dispatched_response,
        "operator_notes": operator_notes,
        "final_outcome": final_outcome
    }

    try:
        client.add(messages, user_id=user_id, metadata=metadata)
        logger.info(f"Successfully added incident memory to Mem0 for zone {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving incident to Mem0: {e}")
        return False

def search_similar_incidents(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    crowd_count: int,
    density_score: float,
    recommended_action: str
) -> List[Dict[str, Any]]:
    """
    Searches Mem0 for similar previous incidents using a rich semantic query.
    Filters by user_id to scope history to the current location.
    """
    if not client:
        logger.warning("Mem0 client not initialized. Skipping search_similar_incidents.")
        return []

    user_id = zone_id.lower().replace(" ", "_")

    # Construct the rich semantic query as specified
    query = (
        f"Current Incident\n"
        f"Zone: {zone_name}\n"
        f"Risk Level: {risk_level}\n"
        f"Crowd Count: {crowd_count}\n"
        f"Density Score: {density_score:.2f}\n"
        f"Recommended Action: {recommended_action}\n\n"
        f"Find similar previous incidents and how they were resolved."
    )

    try:
        results = client.search(query, filters={"user_id": user_id})
        
        # Extract matches
        memories = []
        if isinstance(results, dict) and "results" in results:
            memories = results["results"]
        elif isinstance(results, list):
            memories = results
        else:
            logger.warning(f"Unexpected search results structure from Mem0: {type(results)}")

        # Map to structured format using metadata or parsing fallback
        unique_incidents = []
        seen_dates = set()

        for item in memories:
            meta = item.get("metadata") or {}
            memory_text = item.get("memory", "")

            # Extract fields with metadata as first priority, then parsing/defaults
            date = meta.get("timestamp") or meta.get("date") or item.get("created_at") or "Unknown Date"
            risk = meta.get("risk_level") or risk_level
            action = meta.get("actual_dispatched_response") or meta.get("action_taken") or memory_text or "Dispatched Unit"
            notes = meta.get("operator_notes") or ""
            outcome = meta.get("final_outcome") or "Resolved"

            # Deduplicate by timestamp/date to avoid returning separate facts of the same incident
            if date not in seen_dates:
                seen_dates.add(date)
                unique_incidents.append({
                    "date": date,
                    "risk_level": risk,
                    "action_taken": action,
                    "operator_notes": notes,
                    "outcome": outcome
                })
                # Retrieve the top 1-3 most relevant memories
                if len(unique_incidents) >= 3:
                    break

        return unique_incidents
    except Exception as e:
        logger.error(f"Error searching Mem0: {e}")
        return []
