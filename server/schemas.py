from pydantic import BaseModel
from typing import List, Optional

class PlugBase(BaseModel):
    name: str
    status: str
    # A stored row can legitimately have no reading (a node that has never
    # reported, or a relay switched off mid-write). Typing these as required
    # floats made one null row fail validation and 500 the whole endpoint.
    vrms: Optional[float] = None
    irms: Optional[float] = None
    realPower: Optional[float] = None
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
