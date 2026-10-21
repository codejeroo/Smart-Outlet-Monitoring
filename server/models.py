import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from database import Base

class Plug(Base):
    __tablename__ = "plugs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), index=True)
    status = Column(String(10), default="off")
    vrms = Column(Float, default=0.0)
    irms = Column(Float, default=0.0)
    realPower = Column(Float, default=0.0)
    idleDetection = Column(Boolean, default=False)
    connectedDevice = Column(String(50), default="Idle")
    # Last telemetry frame received from the physical node. Null means the node
    # has never reported, so the row's readings are not evidence of anything.
    lastSeen = Column(DateTime, nullable=True)
    # Result of the last relay command attempt. Null = never attempted,
    # True = the ESP32 acknowledged, False = the command was not delivered.
    relayReachable = Column(Boolean, nullable=True)

class SystemStat(Base):
    __tablename__ = "system_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True)
    value = Column(Float, default=0.0)

class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, index=True)
    plug_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    vrms = Column(Float)
    irms = Column(Float)
    realPower = Column(Float)
    powerFactor = Column(Float)
    connectedDevice = Column(String(50))
