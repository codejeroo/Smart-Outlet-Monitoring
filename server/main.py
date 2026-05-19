from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
import os
import models
import schemas
from database import engine, get_db
from predictor import LightweightRF

# Ensure database tables exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate the lightweight Random Forest classifier on startup
predictor = None
try:
    predictor = LightweightRF()
    print("[SUCCESS] Local Random Forest classifier loaded successfully.")
except Exception as e:
    print(f"[WARNING] Failed to load Random Forest classifier: {e}. Using rule-based fallback.")

def init_db(db: Session):
    # Ensure database schema is migrated (add connectedDevice column if missing in MySQL/MariaDB)
    try:
        db.execute(text("SELECT connectedDevice FROM plugs LIMIT 1"))
    except Exception:
        try:
            db.execute(text("ALTER TABLE plugs ADD COLUMN connectedDevice VARCHAR(50) DEFAULT 'Idle'"))
            db.commit()
            print("[SUCCESS] Database migrated: Added 'connectedDevice' column to 'plugs' table.")
        except Exception as migration_error:
            db.rollback()
            print(f"[ERROR] Failed to automatically migrate database: {migration_error}")

    # Seed initial data if empty
    if db.query(models.Plug).count() == 0:
        p1 = models.Plug(
            id=1, 
            name="Node 1", 
            status="on", 
            vrms=220.5, 
            irms=1.25, 
            realPower=275.6, 
            idleDetection=False, 
            connectedDevice="Other Device"
        )
        p2 = models.Plug(
            id=2, 
            name="Node 2", 
            status="off", 
            vrms=220.1, 
            irms=0.0, 
            realPower=0.0, 
            idleDetection=True, 
            connectedDevice="Idle"
        )
        db.add_all([p1, p2])
        
    for key, val in [("dailyConsumption", 5.242), ("weeklyConsumption", 36.12), ("monthlyConsumption", 145.45)]:
        if db.query(models.SystemStat).filter(models.SystemStat.key == key).first() is None:
            stat = models.SystemStat(key=key, value=val)
            db.add(stat)
        
    db.commit()

@app.on_event("startup")
def on_startup():
    db = next(get_db())
    init_db(db)

@app.get("/api/plugs", response_model=schemas.PlugsResponse)
def read_plugs(db: Session = Depends(get_db)):
    plugs = db.query(models.Plug).all()
    
    daily = db.query(models.SystemStat).filter(models.SystemStat.key == "dailyConsumption").first()
    weekly = db.query(models.SystemStat).filter(models.SystemStat.key == "weeklyConsumption").first()
    monthly = db.query(models.SystemStat).filter(models.SystemStat.key == "monthlyConsumption").first()
    
    return {
        "plugs": plugs, 
        "totalDailyConsumption": daily.value if daily else 0.0,
        "totalWeeklyConsumption": weekly.value if weekly else 0.0,
        "totalMonthlyConsumption": monthly.value if monthly else 0.0
    }

@app.post("/api/plugs/{plug_id}/control")
def control_plug(plug_id: int, status: str, db: Session = Depends(get_db)):
    plug = db.query(models.Plug).filter(models.Plug.id == plug_id).first()
    if not plug:
        raise HTTPException(status_code=404, detail="Plug not found")
    
    plug.status = status
    if status == 'on':
        # Don't inject fake 330W data here; wait for ESP32 to send real telemetry!
        # Just set idleDetection to False so the UI knows it's turning on.
        plug.idleDetection = False
    else:
        plug.irms = 0.0
        plug.realPower = 0.0
        plug.powerFactor = 0.0
        plug.connectedDevice = "Idle"
        
    db.commit()
    db.refresh(plug)
    
    # ----------------- PHYSICAL ESP32 RELAY CONTROL -----------------
    import os
    import urllib.request
    import json
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    # Check both PLUG_X_IP and NODE_X_IP formats in .env
    plug_ip = os.getenv(f"PLUG_{plug_id}_IP") or os.getenv(f"NODE_{plug_id}_IP")
    if not plug_ip:
        if plug_id == 1:
            plug_ip = "172.20.10.2"
        else:
            plug_ip = f"172.20.10.{plug_id + 1}"
            
    # Clean up quotes/spaces
    plug_ip = plug_ip.strip("'\" ")
    
    state_val = (status == "on")
    try:
        url = f"http://{plug_ip}/relay"
        print(f"[RELAY CONTROL] Sending state={state_val} to {url}")
        
        payload = json.dumps({"state": state_val}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        # Timeout of 2.0 seconds to prevent blocking FastAPI thread if ESP32 goes offline
        with urllib.request.urlopen(req, timeout=2.0) as res:
            res_body = res.read().decode("utf-8")
            print(f"[RELAY CONTROL SUCCESS] Response from {plug_ip}: {res.status} - {res_body}")
    except Exception as e:
        print(f"[RELAY CONTROL WARNING] Failed to connect to physical relay at {plug_ip}: {e}")
    # ----------------------------------------------------------------
        
    return {"success": True, "message": f"Plug {plug_id} turned {status}"}

@app.post("/api/plugs/{plug_id}/data")
def update_plug_data(plug_id: int, data: schemas.PlugDataUpdate, db: Session = Depends(get_db)):
    plug = db.query(models.Plug).filter(models.Plug.id == plug_id).first()
    if not plug:
        raise HTTPException(status_code=404, detail="Plug not found")
    
    plug.vrms = data.vrms
    plug.irms = data.irms
    plug.realPower = data.realPower
    plug.idleDetection = data.idleDetection
    
    # Perform local machine learning classification
    if predictor:
        try:
            pred = predictor.predict(data.vrms, data.irms, data.realPower, data.powerFactor)
            print(f"[INFERENCE] V={data.vrms}, I={data.irms}, P={data.realPower}, PF={data.powerFactor} -> {pred}")
            if pred == "phone":
                plug.connectedDevice = "Phone"
            elif pred == "fan":
                plug.connectedDevice = "Fan"
            elif pred == "laptop":
                plug.connectedDevice = "Laptop"
            else:
                plug.connectedDevice = "Idle"
        except Exception as e:
            # Rule-based fallback if inference fails
            if data.realPower > 30.0 or data.irms > 0.15:
                plug.connectedDevice = "Laptop"
            elif data.realPower > 5.0 or data.irms > 0.01:
                if data.powerFactor > 0.8:
                    plug.connectedDevice = "Fan"
                else:
                    plug.connectedDevice = "Phone"
            else:
                plug.connectedDevice = "Idle"
    else:
        # Rule-based classification if predictor is not loaded
        if data.realPower > 30.0 or data.irms > 0.15:
            plug.connectedDevice = "Laptop"
        elif data.realPower > 5.0 or data.irms > 0.01:
            if data.powerFactor > 0.8:
                plug.connectedDevice = "Fan"
            else:
                plug.connectedDevice = "Phone"
        else:
            plug.connectedDevice = "Idle"
            
    # Unconditional physical override: if telemetry indicates zero/negligible current or power, it is Idle
    if data.irms <= 0.005 or data.realPower <= 0.1:
        plug.connectedDevice = "Idle"
            
    # Calculate energy consumption based on elapsed time since the last logged telemetry entry
    # (Default: assume 5.0s heartbeat if no previous logs exist or if offline time is too long)
    import datetime
    time_diff_seconds = 5.0
    last_log = db.query(models.TelemetryLog).filter(models.TelemetryLog.plug_id == plug_id).order_by(models.TelemetryLog.timestamp.desc()).first()
    if last_log:
        elapsed = (datetime.datetime.utcnow() - last_log.timestamp).total_seconds()
        # Cap elapsed to a reasonable range (e.g. 0.1s to 60s) to prevent massive power spikes if server was offline
        if 0.1 < elapsed < 60.0:
            time_diff_seconds = elapsed
            
    # Increment energy totals in kWh: (Power in Watts * time in hours) / 1000
    energy_kwh = (data.realPower * time_diff_seconds) / (3600.0 * 1000.0)
    
    for key in ["dailyConsumption", "weeklyConsumption", "monthlyConsumption"]:
        stat = db.query(models.SystemStat).filter(models.SystemStat.key == key).first()
        if stat:
            stat.value += energy_kwh
            
    # Log this telemetry entry to the telemetry_logs database table
    log_entry = models.TelemetryLog(
        plug_id=plug_id,
        vrms=data.vrms,
        irms=data.irms,
        realPower=data.realPower,
        powerFactor=data.powerFactor,
        connectedDevice=plug.connectedDevice
    )
    db.add(log_entry)
            
    db.commit()
    db.refresh(plug)
    return {"success": True, "message": f"Data updated for plug {plug_id}"}

@app.get("/api/logs")
def get_telemetry_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(models.TelemetryLog).order_by(models.TelemetryLog.timestamp.desc()).limit(limit).all()
    # Format dates nicely for JSON response
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "id": log.id,
            "plug_id": log.plug_id,
            "timestamp": log.timestamp.isoformat() + "Z" if log.timestamp else None,
            "vrms": log.vrms,
            "irms": log.irms,
            "realPower": log.realPower,
            "powerFactor": log.powerFactor,
            "connectedDevice": log.connectedDevice
        })
    return {"logs": formatted_logs}

@app.post("/api/logs/clear")
def clear_system_logs(db: Session = Depends(get_db)):
    try:
        # Delete all telemetry logs
        db.query(models.TelemetryLog).delete()
        
        # Reset stats
        stats = db.query(models.SystemStat).all()
        for stat in stats:
            stat.value = 0.0
            
        db.commit()
        return {"success": True, "message": "All telemetry logs cleared and consumption metrics reset."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}")
