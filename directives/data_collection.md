# Data Collection Directive

This directive outlines the Standard Operating Procedure (SOP) for running the automated data collection protocol to generate high-fidelity, labeled datasets from appliances powered via the Smart Outlet.

## Goal
Collect power telemetry data (Voltage, Current, Power, Power Factor) in a structured and labeled format to train a machine learning model for appliance identification and state classification.

## CSV Output Schema
The output file must strictly follow the format:
```csv
timestamp,vrms,irms,realPower,powerFactor,device_label
```
Where:
- `timestamp`: UTC ISO 8601 string (e.g., `2026-05-18T14:01:00Z`)
- `vrms`: RMS Voltage (V)
- `irms`: RMS Current (A)
- `realPower`: Active Real Power (W)
- `powerFactor`: Power Factor (0.00 to 1.00)
- `device_label`: State-aware label. `Idle` when relay is off or baseline idle. Active device label (e.g., `Desk_Fan`) or state-specific suffix (e.g., `Desk_Fan_Speed1`) when powered on.

## Interactive Steps
The script automates the **Ideal Data Collection Protocol (~15-20 mins per device)**:
1. **Step 1: The Baseline (2 minutes)**: Turn relay OFF, let sensor log data. Label: `Idle`.
2. **Step 2: The First Cycle (5 minutes)**: Turn relay ON automatically, log startup spike and steady state. Label: `<device_label>`.
3. **Step 3: State Changes (If applicable, 1 minute per state)**: Loop through various speeds/modes. Prompt the user to adjust the physical switch and label as `<device_label>_<mode>`.
4. **Step 4: The Cool Down (2 minutes)**: Turn relay OFF, let cool down. Label: `Idle`.
5. **Step 5: Repeat**: Automate Steps 2–4 for 3 or 4 cycles to capture multiple startup spikes.

## Inputs
The runner (`execution/data_collection_runner.py`) accepts the following parameters:
- `--ip`: IP address of the ESP32 (e.g., `192.168.1.100`)
- `--port`: Local PC port to run the data collection server on (default: `8080` or `8000`)
- `--route`: Endpoint path where the ESP32 POSTs data (default: `/api/plugs/1/data`)
- `--device`: Custom device name (e.g., `Desk_Fan`)
- `--cycles`: Number of complete ON/OFF cycles to repeat (default: `3`)
- `--modes`: Comma-separated list of multi-state modes (e.g., `Speed1,Speed2,Speed3`), optional.
- `--output`: Filepath for the saved CSV (default: `data_collection_result.csv`)

## Execution
Run the data collection from the root using:
```bash
python data_collection.py --ip <esp32_ip> --device <device_name>
```
Or run the execution runner directly:
```bash
python execution/data_collection_runner.py --ip 192.168.1.100 --device Desk_Fan --cycles 3 --modes Speed1,Speed2,Speed3
```
