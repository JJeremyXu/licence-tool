import { HID_CONSTANTS } from './constants';
import { LogEntry, LogType } from './types';

// ============================================================================
// Abstract Base Client
// ============================================================================

export abstract class AbstractHIDClient {
  protected device: HIDDevice | null = null;
  protected onLog: (entry: LogEntry) => void;
  protected abstract readonly deviceName: string;

  constructor(onLog: (entry: LogEntry) => void) {
    this.onLog = onLog;
  }

  protected log(type: LogType, message: string, data?: Uint8Array) {
    this.onLog({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message: `[${this.deviceName}] ${message}`,
      data: data ? Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ') : undefined
    });
  }

  protected logPacket(type: 'tx' | 'rx', reportId: number, data: Uint8Array) {
    const totalLen = data.byteLength; 
    const idHex = reportId.toString(16).padStart(2, '0').toUpperCase();
    const dataHex = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    
    const message = `(${totalLen} bytes) [${idHex}] [${dataHex}]`;
    this.log(type, message, undefined);
  }

  async connect(filters: HIDDeviceRequestOptions['filters'] = []): Promise<HIDDevice> {
    if (!navigator.hid) {
      throw new Error("WebHID is not supported in this browser.");
    }

    const devices = await navigator.hid.requestDevice({ filters });

    if (devices.length === 0) {
      throw new Error("No device selected.");
    }

    this.device = devices[0];
    
    if (!this.device.opened) {
      await this.device.open();
    }
    
    this.log('success', `Connected: ${this.device.productName}`);
    return this.device;
  }

  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.log('info', 'Disconnected');
      this.device = null;
    }
  }
  
  isConnected(): boolean {
    return this.device !== null && this.device.opened;
  }

  async sendReport(reportId: number, data: Uint8Array) {
    if (!this.device || !this.device.opened) {
      throw new Error("Device not connected");
    }
    this.logPacket('tx', reportId, data);
    await this.device.sendReport(reportId, data as unknown as BufferSource);
  }

  async sendFeatureReport(reportId: number, data: Uint8Array) {
    if (!this.device || !this.device.opened) {
      throw new Error("Device not connected");
    }
    this.log('info', `Sending Feature Report [${reportId.toString(16).padStart(2, '0').toUpperCase()}]`, data);
    await this.device.sendFeatureReport(reportId, data as unknown as BufferSource);
  }

  async receivePacket(expectedReportId: number, timeoutMs = 2000): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (!this.device || !this.device.opened) {
        return reject(new Error("Device disconnected"));
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for packet [${expectedReportId.toString(16)}]`));
      }, timeoutMs);

      const handler = (event: HIDInputReportEvent) => {
        if (event.reportId === expectedReportId) {
          const data = new Uint8Array(event.data.buffer);
          this.logPacket('rx', event.reportId, data);
          cleanup();
          resolve(data);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        if (this.device) {
           this.device.removeEventListener('inputreport', handler);
        }
      };

      this.device.addEventListener('inputreport', handler);
    });
  }
}

// ============================================================================
// License Dongle Client
// ============================================================================

export class DongleClient extends AbstractHIDClient {
  protected readonly deviceName = 'Dongle';
    
  async connect(): Promise<HIDDevice> {
    return super.connect([{ 
      vendorId: HID_CONSTANTS.VENDOR_ID, 
      productId: HID_CONSTANTS.PRODUCT_ID 
    }]);
  }

  async sendFragmentedData(payload: Uint8Array) {
    if (payload.length !== 128) {
      throw new Error("UUID must be 128 bytes.");
    }
    
    // Chunk 1: 0-61 (62 bytes)
    // Chunk 2: 62-123 (62 bytes)
    // Chunk 3: 124-127 (4 bytes)
    const chunks = [
      payload.slice(0, 62),
      payload.slice(62, 124),
      payload.slice(124, 128)
    ];
    
    for (const chunk of chunks) {
      const reportData = new Uint8Array(63);
      reportData[0] = chunk.length; // Length byte
      reportData.set(chunk, 1);     // Data
      
      await this.sendReport(HID_CONSTANTS.REPORT_ID.GET_LICENSE_OUT, reportData);
    }
  }

  async receiveFragmentedData(): Promise<Uint8Array> {
    // Expect 5 packets -> 256 bytes
    const fullBuffer = new Uint8Array(256);
    let offset = 0;
    
    for (let i = 0; i < 5; i++) {
      const packet = await this.receivePacket(HID_CONSTANTS.REPORT_ID.GET_LICENSE_IN, 3000);
      
      // Packet structure: [Length (1B)] [Data (N)] [Padding]
      const length = packet[0];
      const data = packet.slice(1, 1 + length);
      
      fullBuffer.set(data, offset);
      offset += length;
    }
    
    return fullBuffer;
  }

  async getCounter(): Promise<number | null> {
    const payload = new Uint8Array(63); // Zeros
    await this.sendReport(HID_CONSTANTS.REPORT_ID.GET_COUNTER_OUT, payload);
    
    try {
      const response = await this.receivePacket(HID_CONSTANTS.REPORT_ID.GET_COUNTER_IN, 2000);
      
      const cLow = response[0];
      const cHigh = response[1];
      const counterValue = cLow | (cHigh << 8);
      
      this.log('success', `Counter: ${counterValue}`);
      return counterValue;
    } catch (e) {
      this.log('error', 'Counter check failed: ' + e);
      throw e;
    }
  }
}

// ============================================================================
// Target Device Client
// ============================================================================

export class TargetDeviceClient extends AbstractHIDClient {
  protected readonly deviceName = 'Target';
    
  // Connect to Target Device with specific USB filter
  async connect(): Promise<HIDDevice> {
    return super.connect([{ 
      vendorId: HID_CONSTANTS.TARGET_VENDOR_ID, 
      productId: HID_CONSTANTS.TARGET_PRODUCT_ID 
    }]);
  }

  async readUUID(): Promise<Uint8Array> {
    this.log('info', 'Sending UUID Request (0x80)...');
    
    // Send request with empty data
    const reportOut = new Uint8Array(0);
    await this.sendReport(HID_CONSTANTS.TARGET_REPORT_ID.GET_UUID_REQUEST, reportOut);
    
    this.log('info', 'Waiting for UUID Response (0x81)...');
    
    // Expect 128 bytes UUID in response
    const response = await this.receivePacket(HID_CONSTANTS.TARGET_REPORT_ID.GET_UUID_RESPONSE, 2000);
    
    if (response.byteLength < 128) {
      this.log('error', `UUID read incomplete: got ${response.byteLength}/128 bytes`);
      throw new Error(`UUID must be 128 bytes (got ${response.byteLength})`);
    }
    
    this.log('success', 'UUID Read Complete');
    return response.slice(0, 128);
  }

  async writeLicense(license: Uint8Array): Promise<void> {
    if (license.length !== 256) {
      throw new Error(`License must be 256 bytes (got ${license.length})`);
    }

    this.log('info', 'Writing License (0x82) - 256 bytes in one send...');
    
    await this.sendReport(HID_CONSTANTS.TARGET_REPORT_ID.STORE_LICENSE, license);
    
    this.log('success', 'License Write Complete');
  }
}
