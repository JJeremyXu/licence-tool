import { LogEntry, LogType } from './types';

// Mock Target Device (Earbud) for testing without actual hardware
export class MockDeviceClient {
  private onLog: (entry: LogEntry) => void;
  private mockUUID: Uint8Array;
  
  constructor(onLog: (entry: LogEntry) => void) {
    this.onLog = onLog;
    // Generate a random-ish UUID for demo
    this.mockUUID = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
      this.mockUUID[i] = Math.floor(Math.random() * 256);
    }
  }

  private log(type: LogType, message: string, data?: Uint8Array) {
    this.onLog({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      data: data ? Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ') : undefined
    });
  }

  async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));
    this.log('success', 'Mock Device connected (simulated)');
  }

  async disconnect(): Promise<void> {
    this.log('info', 'Mock Device disconnected');
  }

  async readUUID(): Promise<Uint8Array> {
    this.log('info', 'Reading UUID from Mock Device...');
    
    // Simulate read delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.log('rx', 'UUID Read Complete', this.mockUUID);
    return this.mockUUID;
  }

  async writeLicense(license: Uint8Array): Promise<void> {
    if (license.length !== 256) {
      throw new Error('License must be 256 bytes');
    }
    
    this.log('info', 'Writing license to Mock Device...');
    this.log('tx', 'License Data', license);
    
    // Simulate write delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.log('success', 'License written successfully to Mock Device');
  }

  isConnected(): boolean {
    return true; // Mock is always "connected" once instantiated
  }
}
