export interface DeviceConnectionState {
  isConnected: boolean;
  device: HIDDevice | null;
  error: string | null;
}

export type LogType = 'info' | 'success' | 'error' | 'rx' | 'tx';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  data?: string; // Hex representation
}
