'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { HIDClient } from './hid-client';
import { LogEntry, DeviceConnectionState } from './types';

interface HIDContextType {
  client: HIDClient | null;
  connectionState: DeviceConnectionState;
  logs: LogEntry[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearLogs: () => void;
}

const HIDContext = createContext<HIDContextType>({} as HIDContextType);

export const useHID = () => useContext(HIDContext);

export const HIDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionState, setConnectionState] = useState<DeviceConnectionState>({
    isConnected: false,
    device: null,
    error: null,
  });
  
  const clientRef = useRef<HIDClient | null>(null);

  // Initialize client once
  useEffect(() => {
    clientRef.current = new HIDClient((log) => {
      setLogs(prev => [...prev, log]);
    });
  }, []);

  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const device = await clientRef.current.connect();
      setConnectionState({
        isConnected: true,
        device: device,
        error: null,
      });
      
      // Auto-listen to disconnect event
      device.addEventListener('disconnect', () => {
         setConnectionState(prev => ({ ...prev, isConnected: false, device: null, error: 'Device disconnected' }));
         // Update logs? client log does it.
      });
      
    } catch (err: any) {
      setConnectionState(prev => ({ ...prev, error: err.message }));
      // Log handled in client for some parts, but top level error:
      // clientRef.current.log('error', `Connection failed: ${err.message}`);
      throw err;
    }
  }, []);
  
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
      setConnectionState({
        isConnected: false,
        device: null,
        error: null,
      });
    }
  }, []);

  const clearLogs = () => setLogs([]);

  return (
    <HIDContext.Provider value={{ 
      client: clientRef.current, 
      connectionState, 
      logs, 
      connect, 
      disconnect,
      clearLogs 
    }}>
      {children}
    </HIDContext.Provider>
  );
};
