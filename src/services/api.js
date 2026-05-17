// Mock API Service for Smart Outlet Dashboard

// Internal state to simulate the Raspberry Pi's database
let mockPlugs = [
  {
    id: 1,
    name: "Node 1",
    status: "on",
    vrms: 220.5,
    irms: 1.25,
    realPower: 275.6, // Vrms * Irms approximately
    idleDetection: false
  },
  {
    id: 2,
    name: "Node 2",
    status: "off",
    vrms: 220.1,
    irms: 0.0,
    realPower: 0.0,
    idleDetection: true // Off but plugged in, or idle while on
  }
];

let mockDailyConsumption = 5.242; // Starting kWh for the day

// Helper to simulate network latency
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * GET /api/plugs
 * Returns the current monitoring data for all nodes.
 */
export const getPlugs = async () => {
  await delay(300); // simulate 300ms latency

  // Simulate slight voltage/current fluctuations if plug is ON
  mockPlugs = mockPlugs.map(plug => {
    if (plug.status === "on") {
      const vrmsFluctuation = (Math.random() * 2 - 1); // +/- 1V
      const irmsFluctuation = (Math.random() * 0.1 - 0.05); // +/- 0.05A

      const newVrms = 220 + vrmsFluctuation;
      const newIrms = Math.max(0.1, plug.irms + irmsFluctuation);

      return {
        ...plug,
        vrms: Number(newVrms.toFixed(1)),
        irms: Number(newIrms.toFixed(2)),
        realPower: Number((newVrms * newIrms).toFixed(1)),
        // Randomly simulate idle detection if current is suspiciously low for this appliance
        idleDetection: newIrms < 0.2
      };
    }
    return {
      ...plug,
      vrms: 220.1 + (Math.random() * 1 - 0.5), // Grid voltage still present
      irms: 0,
      realPower: 0,
      idleDetection: false
    };
  });

  // Calculate current total power
  const currentTotalPower = mockPlugs.reduce((sum, plug) => sum + plug.realPower, 0);
  // Simulate increment per fetch (assuming 2 seconds interval, convert W to kWh)
  mockDailyConsumption += (currentTotalPower * (2 / 3600)) / 1000;

  return { 
    plugs: [...mockPlugs],
    totalDailyConsumption: Number(mockDailyConsumption.toFixed(4))
  };
};

/**
 * POST /api/plugs/:id/control
 * Controls the appliance ON/OFF state.
 */
export const controlPlug = async (id, status) => {
  await delay(200); // simulate 200ms latency

  const plugIndex = mockPlugs.findIndex(p => p.id === id);
  if (plugIndex === -1) {
    throw new Error("Plug not found");
  }

  // Update mock state
  mockPlugs[plugIndex] = {
    ...mockPlugs[plugIndex],
    status,
    irms: status === 'on' ? 1.5 : 0, // give a default current when turned on
    realPower: status === 'on' ? (220 * 1.5) : 0,
    idleDetection: false
  };

  return { success: true, message: `Plug ${id} turned ${status}` };
};
