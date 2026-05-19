from pydantic import BaseModel
from typing import List

class PlugBase(BaseModel):
    name: str
    status: str
    vrms: float
    irms: float
    realPower: float
    idleDetection: bool
    connectedDevice: str

class Plug(PlugBase):
    id: int

    class Config:
        from_attributes = True

class PlugsResponse(BaseModel):
    plugs: List[Plug]
    totalDailyConsumption: float
    totalWeeklyConsumption: float
    totalMonthlyConsumption: float

class PlugDataUpdate(BaseModel):
    vrms: float
    irms: float
    realPower: float
    powerFactor: float
    idleDetection: bool
