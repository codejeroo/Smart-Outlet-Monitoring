// API Service for Smart Outlet Dashboard connected to FastAPI

const API_BASE_URL = '/api';

/**
 * GET /api/plugs
 * Returns the current monitoring data for all nodes.
 */
export const getPlugs = async () => {
  const response = await fetch(`${API_BASE_URL}/plugs`);
  if (!response.ok) {
    throw new Error('Failed to fetch plugs data');
  }
  return response.json();
};

/**
 * POST /api/plugs/:id/control
 * Controls the appliance ON/OFF state.
 */
export const controlPlug = async (id, status) => {
  // Query params match the FastAPI endpoint signature: ?status=on|off
  const response = await fetch(`${API_BASE_URL}/plugs/${id}/control?status=${status}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to control plug');
  }
  
  return response.json();
};

/**
 * GET /api/logs
 * Returns historical telemetry log records from the database.
 */
export const getTelemetryLogs = async (limit = 50) => {
  const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch historical telemetry logs');
  }
  return response.json();
};

/**
 * POST /api/logs/clear
 * Clears all historical logs and resets the daily, weekly, and monthly totals.
 */
export const clearTelemetryLogs = async () => {
  const response = await fetch(`${API_BASE_URL}/logs/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to clear telemetry logs and reset stats');
  }
  return response.json();
};
