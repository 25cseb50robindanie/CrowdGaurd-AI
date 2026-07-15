import json
import logging
from agent_chain import run_agent_chain

# Setup logging to show fallback info if any
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_agents")

# 10 distinct scenarios representing different crowd dynamics
mock_scenarios = [
    {
        "id": 1,
        "description": "Critical Overcrowding at Gate 4 (High Density, Rising)",
        "zone_id": "gate4",
        "person_count": 65,
        "density": 5.2,
        "trend": "rising"
    },
    {
        "id": 2,
        "description": "Safe & Stable Courtyard (Low Density, Stable)",
        "zone_id": "courtyard",
        "person_count": 15,
        "density": 1.2,
        "trend": "stable"
    },
    {
        "id": 3,
        "description": "Empty Exit Hallway (Very Low Density, Falling)",
        "zone_id": "exit_hallway",
        "person_count": 2,
        "density": 0.15,
        "trend": "falling"
    },
    {
        "id": 4,
        "description": "Sudden Surge at North Entrance (Medium Density, Rising Rapidly)",
        "zone_id": "north_entrance",
        "person_count": 48,
        "density": 3.8,
        "trend": "rising"
    },
    {
        "id": 5,
        "description": "Gradual Accumulation in Food Court (Medium Density, Rising)",
        "zone_id": "food_court",
        "person_count": 35,
        "density": 2.8,
        "trend": "rising"
    },
    {
        "id": 6,
        "description": "Busy but Stable Ticket Counter (Medium Density, Stable)",
        "zone_id": "ticket_counter",
        "person_count": 27,
        "density": 2.3,
        "trend": "stable"
    },
    {
        "id": 7,
        "description": "Dispersing Main Arena Exit (High Density, Falling)",
        "zone_id": "arena_exit",
        "person_count": 52,
        "density": 4.1,
        "trend": "falling"
    },
    {
        "id": 8,
        "description": "Restricted Zone Build-up (Low Density, Rising)",
        "zone_id": "vip_lounge",
        "person_count": 12,
        "density": 1.6,
        "trend": "rising"
    },
    {
        "id": 9,
        "description": "Stagnant Bottleneck at Ticket Gate 2 (High Density, Stable)",
        "zone_id": "ticket_gate_2",
        "person_count": 58,
        "density": 4.9,
        "trend": "stable"
    },
    {
        "id": 10,
        "description": "Cleared Security Checkpoint (Low Density, Falling)",
        "zone_id": "security_check",
        "person_count": 4,
        "density": 0.4,
        "trend": "falling"
    }
]

def run_tests():
    print("=" * 70)
    print("       CROWDGUARDAI AGENT SYSTEM - 10-SCENARIO INTEGRATION TEST")
    print("=" * 70)

    all_passed = True

    for scenario in mock_scenarios:
        print(f"\n[SCENARIO {scenario['id']}] {scenario['description']}")
        print(f"Input JSON:")
        input_payload = {
            "zone_id": scenario["zone_id"],
            "person_count": scenario["person_count"],
            "density": scenario["density"],
            "trend": scenario["trend"]
        }
        print(json.dumps(input_payload, indent=2))
        
        try:
            result = run_agent_chain(
                zone_id=scenario['zone_id'],
                person_count=scenario['person_count'],
                density=scenario['density'],
                trend=scenario['trend']
            )

            print("Agent Chain Output:")
            print(json.dumps(result, indent=2))

            # Validate contract keys
            required_keys = ["zone_id", "risk_level", "prediction", "recommendation", "explanation"]
            missing_keys = [k for k in required_keys if k not in result]

            if missing_keys:
                print(f"[-] FAIL: Missing contract keys: {missing_keys}")
                all_passed = False
                continue

            if result["risk_level"] not in ["high", "medium", "low"]:
                print(f"[-] FAIL: Invalid risk_level '{result['risk_level']}' (must be high, medium, low)")
                all_passed = False
                continue

            print("[+] PASS: Successfully processed and validated.")

        except Exception as e:
            print(f"[-] FAIL: Unexpected error occurred: {e}")
            all_passed = False

    print("\n" + "=" * 70)
    if all_passed:
        print(" SUCCESS: All 10 scenarios successfully processed and validated!")
    else:
        print(" FAILURE: Some scenarios failed validation.")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
