import { HID_CONSTANTS } from './constants';
import { LogEntry, LogType } from './types';

export class HIDClient {
  private device: HIDDevice | null = null;
  private onLog: (entry: LogEntry) => void;

  constructor(onLog: (entry: LogEntry) => void) {
    this.onLog = onLog;
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

  private logPacket(type: 'tx' | 'rx', reportId: number, data: Uint8Array) {
      // Format: (TX) (64 bytes) [81] [01 23 45 ...]
      // We assume data is the payload. Total length = payload + 1 (Report ID).
      // Note: DebugConsole adds Timestamp.
      
      const totalLen = data.byteLength + 1; 
      const idHex = reportId.toString(16).padStart(2, '0').toUpperCase();
      const dataHex = Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      
      const message = `(${totalLen} bytes) [${idHex}] [${dataHex}]`;
      
      // We pass undefined for 'data' in LogEntry so DebugConsole doesn't print it again on new line
      this.log(type, message, undefined);
  }

  async connect(): Promise<HIDDevice> {
    if (!navigator.hid) {
      throw new Error("WebHID is not supported in this browser.");
    }

    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: HID_CONSTANTS.VENDOR_ID, productId: HID_CONSTANTS.PRODUCT_ID }]
    });

    if (devices.length === 0) {
      throw new Error("No device selected.");
    }

    this.device = devices[0];
    
    if (!this.device.opened) {
      await this.device.open();
    }
    
    this.log('success', `Connected to device: ${this.device.productName}`);
    return this.device;
  }

  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.log('info', 'Disconnected device');
      this.device = null;
    }
  }

  async sendReport(reportId: number, data: Uint8Array) {
    if (!this.device || !this.device.opened) {
      throw new Error("Device not connected");
    }

    // Prepare packet: [ReportID] [Length] [Payload...] [Padding...]
    // Note: sendReport takes reportId as first arg, and data as second arg.
    // The device expects [ID] [LEN] [DATA] [PAD]
    // Navigator.hid.sendReport sends the ID automatically as part of the USB packet if we pass it as arg.
    // The data array should contain the rest.
    
    // However, the python script does:
    // report = bytes([REPORT_ID]) + bytes([LEN]) + bytes(DATA) + padding
    // device.write(report)
    // python hid library write includes the report ID in the buffer if the first byte matches.
    
    // WebHID `sendReport(reportId, data)`:
    // data should NOT contain the reportId.
    
    // The python script constructs 64 bytes total.
    // WebHID handles the report ID. So we need to construct the rest (63 bytes).
    // Byte 0 of what we send to sendReport: Length.
    // Byte 1..N: Payload.
    // Rest: Padding.
    
    // BUT, we need to be careful.
    // Does the device expect the Report ID in the 64-byte payload or is it strictly USB HID Report ID?
    // Python's `device.write([0x01, ...])` usually sends to Report 0x01.
    // So the payload is effectively bytes 1..63.
    // Wait, Python script:
    // report = bytes([REPORT_ID]) + bytes([size]) + ...
    // For 128 byte UUID sending, we have chunks.
    // The `data` arg here is the RAW PAYLOAD to go into the report, NOT formatted yet?
    // Let's assume `sendPacket` takes the exact payload bytes (Length + Data + Padding).
    // Or should `sendReport` helper handle the formatting?
    
    // Let's genericize: sendPacket(reportId, payloadBytes)
    // payloadBytes should be exactly 63 bytes? or less and we pad?
    
    // Python: `bytes([size]) + bytes(buffer[i]) + bytes(padding)`
    // So byte 0 is size.
    
    // I will write a lower level `sendPacket` that takes constructed 63 bytes.
    
    this.logPacket('tx', reportId, data);
    // @ts-expect-error Data is BufferSource
    await this.device.sendReport(reportId, data);
  }

  async receivePacket(expectedReportId: number, timeoutMs = 2000): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (!this.device || !this.device.opened) {
        return reject(new Error("Device disconnected"));
      }

      const abortController = new AbortController();
      const timer = setTimeout(() => {
        abortController.abort();
        cleanup();
        reject(new Error("Timeout waiting for packet"));
      }, timeoutMs);

      const handler = (event: HIDInputReportEvent) => {
        if (event.reportId === expectedReportId) {
          // Found it.
          // event.data matches the payload (without report ID).
          // We return the raw data view.
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
  
  // High level helpers
  
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
        // Rest is 0 initialized (padded)
        
        await this.sendReport(HID_CONSTANTS.REPORT_ID.GET_LICENSE_OUT, reportData);
    }
  }

  async receiveFragmentedData(): Promise<Uint8Array> {
    // Expect 5 packets:
    // 4x 62 bytes
    // 1x 8 bytes
    // Total 256 bytes
    
    const fullBuffer = new Uint8Array(256);
    let offset = 0;
    
    // We need to listen broadly or loop.
    // The device sends them in burst? Or we need to poll?
    // Python script calls `read` 5 times sequentially. This implies burst or buffered.
    
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
    // Send 0x04 [00...]
    const payload = new Uint8Array(63); // Zeros
    await this.sendReport(HID_CONSTANTS.REPORT_ID.GET_COUNTER_OUT, payload);
    
    // Expect 0x03
    try {
        const response = await this.receivePacket(HID_CONSTANTS.REPORT_ID.GET_COUNTER_IN, 2000);
        console.log('Counter response', response);
        
        // Parse counter value from bytes 10-11 (little-endian uint16)
        // Response format: [Length][...data...] where counter is at index 10-11 of the data portion
        // Since response doesn't include the report ID, byte 0 is Length, bytes 1+ are data
        // So counter is at response[10] and response[11]
        const counterLow = response[0];
        const counterHigh = response[1];
        const counterValue = counterLow | (counterHigh << 8);
        
        this.log('success', `Connection test passed (Received Counter, ${response.length} bytes). Counter value: ${counterValue}`);
        return counterValue;
    } catch (e) {
        this.log('error', 'Connection test failed: ' + e);
        return null;
    }
  }
}
