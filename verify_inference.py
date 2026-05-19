import os
import sys

# Add server directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "server")))

from predictor import LightweightRF

def run_tests():
    print("==================================================")
    print("      VERIFYING PURE-PYTHON RANDOM FOREST MODEL   ")
    print("==================================================")
    
    # Initialize predictor
    try:
        predictor = LightweightRF(os.path.join("server", "model.json"))
        print("[SUCCESS] LightweightRF loaded model.json successfully.")
    except Exception as e:
        print(f"[FAIL] Failed to load predictor: {e}")
        return
        
    # Standard testing cases using real-world device telemetry
    test_cases = [
        {
            "name": "Zero-power active line (Idle/Unplugged)",
            "vrms": 0.0, "irms": 0.0, "realPower": 0.0, "powerFactor": 0.0,
            "expected": "Idle"
        },
        {
            "name": "Standard Phone Charger (Active charging)",
            "vrms": 225.0, "irms": 0.08, "realPower": 8.5, "powerFactor": 0.48,
            "expected": "phone"
        },
        {
            "name": "Desk Fan (Active low-power)",
            "vrms": 225.0, "irms": 0.04, "realPower": 7.8, "powerFactor": 0.88,
            "expected": "fan"
        },
        {
            "name": "Laptop Charger (Active high-power)",
            "vrms": 224.5, "irms": 0.45, "realPower": 85.0, "powerFactor": 0.87,
            "expected": "laptop"
        }
    ]
    
    passed = 0
    print("\nRunning test cases:")
    print("-" * 75)
    print(f"{'Test Case Name':<35} | {'Telemetry (V, A, W, PF)':<22} | {'Predicted':<8} | {'Status':<5}")
    print("-" * 75)
    
    for case in test_cases:
        pred = predictor.predict(case["vrms"], case["irms"], case["realPower"], case["powerFactor"])
        probs = predictor.predict_proba(case["vrms"], case["irms"], case["realPower"], case["powerFactor"])
        
        # Display nicely
        telemetry_str = f"{case['vrms']:.1f}V, {case['irms']:.2f}A, {case['realPower']:.1f}W, {case['powerFactor']:.2f}"
        
        if pred == case["expected"]:
            status_str = "\033[92mPASS\033[0m"
            passed += 1
        else:
            status_str = f"\033[91mFAIL (Expected: {case['expected']})\033[0m"
            
        print(f"{case['name']:<35} | {telemetry_str:<22} | {pred:<8} | {status_str}")
        print(f"   -> Probs: { {cls: round(p*100, 1) for cls, p in zip(predictor.classes, probs)} }")
        
    print("-" * 75)
    print(f"Results: {passed}/{len(test_cases)} tests passed.")
    if passed == len(test_cases):
        print("\033[92;1m[SUCCESS] ALL TESTING CASES COMPLETED SUCCESSFULLY! MODEL IS ROCK SOLID!\033[0m")
    else:
        print("\033[91;1m[FAIL] SOME TEST CASES FAILED. PLEASE ANALYZE MODEL BOUNDARIES.\033[0m")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
