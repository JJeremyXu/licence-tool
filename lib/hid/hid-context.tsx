'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DongleClient, TargetDeviceClient, AbstractHIDClient } from './hid-client';
import { LogEntry, DeviceConnectionState } from './types';

// ============================================================================
// Device Handle - Unified interface for managing a device
// ============================================================================

interface DeviceHandle<T extends AbstractHIDClient> {
  client: T | null;
  connectionState: DeviceConnectionState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// ============================================================================
// HID Context Type
// ============================================================================

interface HIDContextType {
  dongle: DeviceHandle<DongleClient>;
  target: DeviceHandle<TargetDeviceClient>;
  logs: LogEntry[];
  clearLogs: () => void;
}

const HIDContext = createContext<HIDContextType>({} as HIDContextType);

export const useHID = () => useContext(HIDContext);

// ============================================================================
// HID Provider
// ============================================================================

export const HIDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Shared logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  // ---- Dongle State ----
  const [dongleClient, setDongleClient] = useState<DongleClient | null>(null);
  const [dongleState, setDongleState] = useState<DeviceConnectionState>({
    isConnected: false,
    device: null,
    error: null,
  });

  // Initialize dongle client once on mount
  useEffect(() => {
    setDongleClient(new DongleClient(addLog));
  }, [addLog]);

  const connectDongle = useCallback(async () => {
    if (!dongleClient) return;
    try {
      const device = await dongleClient.connect();
      setDongleState({
        isConnected: true,
        device: device,
        error: null,
      });
      
      device.addEventListener('disconnect', () => {
        setDongleState(prev => ({ ...prev, isConnected: false, device: null, error: 'Device disconnected' }));
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDongleState(prev => ({ ...prev, error: message }));
      throw err;
    }
  }, [dongleClient]);

  const disconnectDongle = useCallback(async () => {
    if (dongleClient) {
      await dongleClient.disconnect();
      setDongleState({
        isConnected: false,
        device: null,
        error: null,
      });
    }
  }, [dongleClient]);

  // ---- Target State ----
  const [targetClient, setTargetClient] = useState<TargetDeviceClient | null>(null);
  const [targetState, setTargetState] = useState<DeviceConnectionState>({
    isConnected: false,
    device: null,
    error: null,
  });

  // Initialize target client once on mount
  useEffect(() => {
    setTargetClient(new TargetDeviceClient(addLog));
  }, [addLog]);

  const connectTarget = useCallback(async () => {
    if (!targetClient) return;
    try {
      const device = await targetClient.connect();
      setTargetState({
        isConnected: true,
        device: device,
        error: null,
      });
      
      device.addEventListener('disconnect', () => {
        setTargetState(prev => ({ ...prev, isConnected: false, device: null, error: 'Device disconnected' }));
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTargetState(prev => ({ ...prev, error: message }));
      throw err;
    }
  }, [targetClient]);

  const disconnectTarget = useCallback(async () => {
    if (targetClient) {
      await targetClient.disconnect();
      setTargetState({
        isConnected: false,
        device: null,
        error: null,
      });
    }
  }, [targetClient]);

  // ---- Build Context Value ----
  const dongle: DeviceHandle<DongleClient> = {
    client: dongleClient,
    connectionState: dongleState,
    connect: connectDongle,
    disconnect: disconnectDongle,
  };

  const target: DeviceHandle<TargetDeviceClient> = {
    client: targetClient,
    connectionState: targetState,
    connect: connectTarget,
    disconnect: disconnectTarget,
  };

  return (
    <HIDContext.Provider value={{ dongle, target, logs, clearLogs }}>
      {children}
    </HIDContext.Provider>
  );
};
