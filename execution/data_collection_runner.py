import os
import sys
import time
import json
import csv
import queue
import argparse
import threading
import urllib.request
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Request

# Ensure we can import from the main server folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Try importing database Session and Models for live updates
db_available = False
try:
    from server.database import SessionLocal
    from server import models
    db_available = True
except Exception as e:
    # Quietly fail if server directory or database is not accessible
    pass

# Create the FastAPI app that will receive data from the ESP32
app = FastAPI()
data_queue = queue.Queue()
latest_reading = {}

# Global variable to store active configuration
active_config = {
    "esp32_ip": "[IP_ADDRESS]",
    "device_name": "Phone",
    "current_step": "Initializing",
    "current_label": "Idle",
    "current_cycle": 1,
    "relay_state": False,
    "remaining_time": 0,
    "total_elapsed": 0,
    "log_history": []
}

@app.post("/api/plugs/{plug_id}/data")
async def receive_plug_data(plug_id: int, request: Request):
    global latest_reading
    try:
        payload = await request.json()
        
        # Standardize keys (handling mixed casing just in case)
        vrms = float(payload.get("vrms", payload.get("Vrms", 0.0)))
        irms = float(payload.get("irms", payload.get("Irms", 0.0)))
        real_power = float(payload.get("realPower", payload.get("Power", 0.0)))
        power_factor = float(payload.get("powerFactor", payload.get("PF", payload.get("pf", 0.0))))
        idle_det = bool(payload.get("idleDetection", False))
        
        reading = {
            "vrms": vrms,
            "irms": irms,
            "realPower": real_power,
            "powerFactor": power_factor,
            "idleDetection": idle_det,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ") # Match requested ISO UTC format
        }
        
        latest_reading = reading
        data_queue.put(reading)
        
        # Update database so the web dashboard still reflects live data
        if db_available:
            try:
                db = SessionLocal()
                # Update plug status and telemetry
                plug = db.query(models.Plug).filter(models.Plug.id == plug_id).first()
                if plug:
                    plug.vrms = vrms
                    plug.irms = irms
                    plug.realPower = real_power
                    plug.idleDetection = idle_det
                    plug.status = "on" if active_config["relay_state"] else "off"
                    db.commit()
                db.close()
            except Exception:
                pass # Non-blocking db write error
                
        return {"status": "Success", "message": "Telemetry received"}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

def toggle_esp32_relay(ip: str, state: bool):
    """Sends a POST request to toggle the ESP32 relay."""
    url = f"http://{ip}/relay"
    payload = json.dumps({"state": state}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            active_config["relay_state"] = state
            return True, res_data.get("message", f"Relay set to {'HIGH' if state else 'LOW'}")
    except Exception as e:
        # Update state locally anyway to keep running
        active_config["relay_state"] = state
        return False, f"Failed to connect to ESP32: {str(e)}"

def format_time(seconds: int) -> str:
    """Helper to format seconds into MM:SS"""
    mins = int(seconds) // 60
    secs = int(seconds) % 60
    return f"{mins:02d}:{secs:02d}"

def render_dashboard(total_duration: int, total_elapsed: int):
    """Draws a premium and responsive terminal dashboard showing protocol progress and live PZEM readings."""
    # Clear console (works on Windows & Unix)
    os.system('cls' if os.name == 'nt' else 'clear')
    
    # Header Banner
    print("\033[96m==================================================================================")
    print("      *  SMART OUTLET - HIGH-FIDELITY AUTOMATED DATA COLLECTION TERMINAL  *")
    print("==================================================================================\033[0m")
    
    # 2. Main Config and Info Area
    print(f"\033[93mDevice Name:\033[0m {active_config['device_name']:<18} | \033[93mTarget ESP32 IP:\033[0m {active_config['esp32_ip']:<15} | \033[93mDatabase Link:\033[0m {'Connected' if db_available else 'Offline'}")
    print(f"\033[93mCurrent Step:\033[0m {active_config['current_step']:<17} | \033[93mCSV Label:\033[0m {active_config['current_label']:<18} | \033[93mActive Cycle:\033[0m {active_config['current_cycle']}")
    
    relay_status_str = "\033[92m[ON] (POWERING)\033[0m" if active_config["relay_state"] else "\033[91m[OFF] (IDLE)\033[0m"
    print(f"\033[93mRelay State:\033[0m {relay_status_str:<28} | \033[93mStep Timer:\033[0m \033[95m{format_time(active_config['remaining_time'])}\033[0m")
    print("\033[96m----------------------------------------------------------------------------------\033[0m")
    
    # 3. Live PZEM Telemetry Block
    v = latest_reading.get("vrms", 0.0)
    i = latest_reading.get("irms", 0.0)
    p = latest_reading.get("realPower", 0.0)
    pf = latest_reading.get("powerFactor", 0.0)
    idle = "Idle" if latest_reading.get("idleDetection", True) else "Active"
    
    print("\033[97;1m  LIVE PZEM SENSOR TELEMETRY:\033[0m")
    print(f"    Voltage:    \033[92;1m{v:6.1f} V\033[0m      Current:      \033[92;1m{i:6.2f} A\033[0m")
    print(f"    Real Power: \033[92;1m{p:6.1f} W\033[0m      Power Factor: \033[92;1m{pf:6.2f}\033[0m (ESP32 State: {idle})")
    print("\033[96m----------------------------------------------------------------------------------\033[0m")
    
    # 4. Progress Visualization
    width = 40
    progress = 0.0 if total_duration == 0 else min(1.0, float(total_elapsed) / total_duration)
    filled = int(width * progress)
    bar = "#" * filled + "-" * (width - filled)
    percent = int(progress * 100)
    
    print(f"  \033[97;1mTOTAL PROTOCOL PROGRESS:\033[0m  [{bar}] {percent}%  ({format_time(total_elapsed)} / {format_time(total_duration)})")
    print("\033[96m----------------------------------------------------------------------------------\033[0m")
    
    # 5. Live Log Feed (last 5 rows)
    print("\033[97;1m  RECENTLY LOGGED DATA (CSV SNEAK PEEK):\033[0m")
    print("  %-22s | %-7s | %-7s | %-9s | %-11s | %-12s" % ("Timestamp", "Vrms", "Irms", "Power(W)", "PowerFactor", "Label"))
    print("  --------------------------------------------------------------------------------")
    history = active_config["log_history"][-5:]
    if not history:
        print("  Waiting for data stream from ESP32...")
    else:
        for row in history:
            print("  %-22s | %-7.1f | %-7.2f | %-9.1f | %-11.2f | \033[93m%-12s\033[0m" % (
                row[0], float(row[1]), float(row[2]), float(row[3]), float(row[4]), row[5]
            ))
    print("\033[96m==================================================================================\033[0m")

def run_server(host: str, port: int):
    """Function to run the Uvicorn server in a separate thread."""
    config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

def main():
    parser = argparse.ArgumentParser(description="Automated Data Collection Protocol for Smart Outlet.")
    parser.add_argument("--ip", type=str, required=True, help="ESP32 IP Address")
    parser.add_argument("--device", type=str, required=True, help="Appliance Label (e.g. Desk_Fan)")
    parser.add_argument("--port", type=int, default=8080, help="Local server port to bind to")
    parser.add_argument("--cycles", type=int, default=3, help="Number of ON-OFF repeat cycles")
    parser.add_argument("--modes", type=str, default="", help="Comma-separated list of modes (e.g. Speed1,Speed2,Speed3)")
    parser.add_argument("--output", type=str, default="data_collection_result.csv")
    parser.add_argument("--test-mode", action="store_true", help="Compresses timing for testing (seconds instead of minutes)")
    args = parser.parse_args()

    active_config["esp32_ip"] = args.ip
    active_config["device_name"] = args.device

    # Parse physical modes/states
    device_modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    
    # Establish Timings (Normal minutes vs Test seconds)
    multiplier = 1 if args.test_mode else 60
    baseline_time = 2 * multiplier
    active_time = 5 * multiplier
    mode_time = 1 * multiplier
    cooldown_time = 2 * multiplier
    
    # Calculate Total Protocol Time
    one_cycle_time = active_time + (len(device_modes) * mode_time) + cooldown_time
    total_protocol_duration = baseline_time + (args.cycles * one_cycle_time)
    
    # Prepare CSV File and write headers
    csv_file_exists = os.path.exists(args.output)
    csv_file = open(args.output, "a", newline="", encoding="utf-8")
    csv_writer = csv.writer(csv_file)
    
    if not csv_file_exists or os.path.getsize(args.output) == 0:
        csv_writer.writerow(["timestamp", "vrms", "irms", "realPower", "powerFactor", "device_label"])
        csv_file.flush()

    # Start local server to receive data from ESP32
    print(f"Starting local server to receive ESP32 data on port {args.port}...")
    server_thread = threading.Thread(target=run_server, args=("0.0.0.0", args.port), daemon=True)
    server_thread.start()
    
    # Small pause to allow server to spin up
    time.sleep(1)
    
    print(f"\nLocal server is running!")
    print(f"Make sure your ESP32 is flashing or configured to send data to: http://<your_computer_ip>:{args.port}/api/plugs/1/data")
    print(f"Confirming connection and baseline status...")
    
    total_elapsed = 0
    start_time = time.time()
    
    try:
        # --- STEP 1: BASELINE (Relay OFF, 2 minutes) ---
        active_config["current_step"] = "Step 1: Baseline"
        active_config["current_label"] = "Idle"
        active_config["remaining_time"] = baseline_time
        
        # Turn relay OFF first
        success, msg = toggle_esp32_relay(args.ip, False)
        
        # Loop for Step 1 duration
        step_elapsed = 0
        while step_elapsed < baseline_time:
            time.sleep(1)
            step_elapsed += 1
            total_elapsed = int(time.time() - start_time)
            active_config["remaining_time"] = max(0, baseline_time - step_elapsed)
            
            # Drain data queue and log
            while not data_queue.empty():
                reading = data_queue.get_nowait()
                row = [
                    reading["timestamp"],
                    f"{reading['vrms']:.1f}",
                    f"{reading['irms']:.2f}",
                    f"{reading['realPower']:.1f}",
                    f"{reading['powerFactor']:.2f}",
                    "Idle" # Label is Idle
                ]
                csv_writer.writerow(row)
                csv_file.flush()
                active_config["log_history"].append(row)
                
            render_dashboard(total_protocol_duration, total_elapsed)

        # --- REPEAT CYCLES (Steps 2 - 4 repeated) ---
        for cycle in range(1, args.cycles + 1):
            active_config["current_cycle"] = cycle
            
            # --- STEP 2: FIRST CYCLE / ACTIVE STABLE (Relay ON, 5 minutes) ---
            active_config["current_step"] = f"Step 2: ON Cycle {cycle}"
            active_config["current_label"] = args.device
            active_config["remaining_time"] = active_time
            
            # Automatically turn relay ON
            success, msg = toggle_esp32_relay(args.ip, True)
            
            step_elapsed = 0
            while step_elapsed < active_time:
                time.sleep(1)
                step_elapsed += 1
                total_elapsed = int(time.time() - start_time)
                active_config["remaining_time"] = max(0, active_time - step_elapsed)
                
                # Drain data queue and log
                while not data_queue.empty():
                    reading = data_queue.get_nowait()
                    row = [
                        reading["timestamp"],
                        f"{reading['vrms']:.1f}",
                        f"{reading['irms']:.2f}",
                        f"{reading['realPower']:.1f}",
                        f"{reading['powerFactor']:.2f}",
                        args.device # Label is the active device name
                    ]
                    csv_writer.writerow(row)
                    csv_file.flush()
                    active_config["log_history"].append(row)
                    
                render_dashboard(total_protocol_duration, total_elapsed)

            # --- STEP 3: STATE CHANGES (1 minute per state) ---
            if device_modes:
                active_config["current_step"] = f"Step 3: State Changes"
                
                for mode in device_modes:
                    mode_label = f"{args.device}_{mode}"
                    active_config["current_label"] = mode_label
                    active_config["remaining_time"] = mode_time
                    
                    # Sound alert and wait for physical user switch
                    print(f"\a\n\033[93;1m>>> PHYSICAL INTERVENTION REQUIRED: Set appliance to [{mode}]! <<<\033[0m")
                    print("\033[95mPress ENTER once the appliance has been physically adjusted...\033[0m")
                    
                    # Wait for user ENTER in a non-blocking way for the dashboard
                    # In real operation, we block the state machine, but we still handle telemetry
                    user_confirmed = False
                    
                    def wait_for_enter():
                        nonlocal user_confirmed
                        input()
                        user_confirmed = True
                        
                    confirm_thread = threading.Thread(target=wait_for_enter, daemon=True)
                    confirm_thread.start()
                    
                    # Keep rendering dashboard while waiting for user confirmation
                    while not user_confirmed:
                        time.sleep(0.5)
                        # Keep draining queue so we don't drop data while waiting
                        while not data_queue.empty():
                            reading = data_queue.get_nowait()
                            # We can log it as pre-change or wait, let's log it under previous step/label
                            row = [
                                reading["timestamp"],
                                f"{reading['vrms']:.1f}",
                                f"{reading['irms']:.2f}",
                                f"{reading['realPower']:.1f}",
                                f"{reading['powerFactor']:.2f}",
                                active_config["current_label"]
                            ]
                            csv_writer.writerow(row)
                            csv_file.flush()
                            active_config["log_history"].append(row)
                        
                        render_dashboard(total_protocol_duration, int(time.time() - start_time))
                    
                    # Once confirmed, log for the specified mode time
                    step_elapsed = 0
                    while step_elapsed < mode_time:
                        time.sleep(1)
                        step_elapsed += 1
                        total_elapsed = int(time.time() - start_time)
                        active_config["remaining_time"] = max(0, mode_time - step_elapsed)
                        
                        while not data_queue.empty():
                            reading = data_queue.get_nowait()
                            row = [
                                reading["timestamp"],
                                f"{reading['vrms']:.1f}",
                                f"{reading['irms']:.2f}",
                                f"{reading['realPower']:.1f}",
                                f"{reading['powerFactor']:.2f}",
                                mode_label # Label is Device_Mode
                            ]
                            csv_writer.writerow(row)
                            csv_file.flush()
                            active_config["log_history"].append(row)
                            
                        render_dashboard(total_protocol_duration, total_elapsed)

            # --- STEP 4: COOL DOWN (Relay OFF, 2 minutes) ---
            active_config["current_step"] = f"Step 4: Cool Down {cycle}"
            active_config["current_label"] = "Idle"
            active_config["remaining_time"] = cooldown_time
            
            # Automatically turn relay OFF
            success, msg = toggle_esp32_relay(args.ip, False)
            
            step_elapsed = 0
            while step_elapsed < cooldown_time:
                time.sleep(1)
                step_elapsed += 1
                total_elapsed = int(time.time() - start_time)
                active_config["remaining_time"] = max(0, cooldown_time - step_elapsed)
                
                # Drain data queue and log
                while not data_queue.empty():
                    reading = data_queue.get_nowait()
                    row = [
                        reading["timestamp"],
                        f"{reading['vrms']:.1f}",
                        f"{reading['irms']:.2f}",
                        f"{reading['realPower']:.1f}",
                        f"{reading['powerFactor']:.2f}",
                        "Idle" # Label is Idle during cool down
                    ]
                    csv_writer.writerow(row)
                    csv_file.flush()
                    active_config["log_history"].append(row)
                    
                render_dashboard(total_protocol_duration, total_elapsed)
                
        # --- FINISH PROTOCOL ---
        active_config["current_step"] = "Protocol Completed!"
        active_config["remaining_time"] = 0
        render_dashboard(total_protocol_duration, total_protocol_duration)
        
        print("\n\033[92;1m[SUCCESS] DATA COLLECTION COMPLETE! [SUCCESS]\033[0m")
        print(f"Dataset successfully compiled and saved to: \033[93m{os.path.abspath(args.output)}\033[0m")
        print(f"Total datapoints collected: \033[93m{len(active_config['log_history'])}\033[0m")
        
    except KeyboardInterrupt:
        print("\n\033[91;1m[WARNING] Process interrupted by user. Exiting and saving partial progress... [WARNING]\033[0m")
    finally:
        csv_file.close()
        # Always turn off relay on exit for safety
        print("\033[93mSafety Shutdown: Toggling relay OFF...\033[0m")
        toggle_esp32_relay(args.ip, False)
        print("\033[92mRelay turned OFF safely. Goodbye!\033[0m")

if __name__ == "__main__":
    main()
