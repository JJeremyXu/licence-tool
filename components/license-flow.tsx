'use client';

import React, { useState } from 'react';
import { useHID } from '@/lib/hid/hid-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Check, Usb, Key, FileJson, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

// Helper to format hex string
const toHex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
};

export function LicenseFlow() {
  const { dongle, target, logs, clearLogs } = useHID();
  const [currentStep, setCurrentStep] = useState(1);
  const [uuidInput, setUuidInput] = useState<string>(''); 
  const [licenseData, setLicenseData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Target Device UI State
  const [reportIdInput, setReportIdInput] = useState('00');
  const [reportDataInput, setReportDataInput] = useState('');
  const [featureReportIdInput, setFeatureReportIdInput] = useState('00');
  const [featureReportDataInput, setFeatureReportDataInput] = useState('');
  const [activeTab, setActiveTab] = useState<'report' | 'feature' | 'logs'>('report');

  // Step 1: Connection
  const handleConnect = async () => {
    try {
      await dongle.connect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to connect: ${message}`);
    }
  };

  const handleTestConnection = async () => {
    if (!dongle.client) return;
    setIsProcessing(true);
    try {
      const counterValue = await dongle.client.getCounter();
      if (counterValue !== null) {
        toast.success(`Dongle handshake successful! Counter: ${counterValue}`);
        setCurrentStep(2);
      } else {
        toast.error("Dongle handshake failed. Check logs.");
      }
    } catch {
      toast.error("Dongle handshake failed. Check logs.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Read UUID (Manual)
  const handleReadUUID = () => {
    toast.info("Please use the Target Device controls below to read the UUID manually.");
  };

  // Target Device Connection
  const handleConnectTarget = async () => {
    try {
      await target.connect();
      toast.success(`Connected to Target Device`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to connect: ${message}`);
    }
  };

  const handleDisconnectTarget = async () => {
    await target.disconnect();
    toast.success("Target Device Disconnected");
  };

  const handleSendReport = async () => {
    if (!target.client) return;
    try {
      const id = parseInt(reportIdInput, 16);
      const data = fromHex(reportDataInput.replace(/\s/g, ''));
      await target.client.sendReport(id, data);
      toast.success("Report Sent");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Send Failed: " + message);
    }
  };

  const handleSendFeatureReport = async () => {
    if (!target.client) return;
    try {
      const id = parseInt(featureReportIdInput, 16);
      const data = fromHex(featureReportDataInput.replace(/\s/g, ''));
      await target.client.sendFeatureReport(id, data);
      toast.success("Feature Report Sent");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Send Feature Report Failed: " + message);
    }
  };

  const handleConfirmUUID = () => {
    if (uuidInput.length !== 256) { // 128 bytes * 2
        toast.error(`UUID must be 128 bytes (256 hex chars). Current: ${uuidInput.length}`);
        return;
    }
    setCurrentStep(3);
  };

  // Step 3: Generate License
  const handleGenerateLicense = async () => {
    if (!dongle.client) return;
    setIsProcessing(true);
    try {
        const uuidBytes = fromHex(uuidInput);
        
        toast.message("Sending UUID to Dongle...", { description: "128 bytes in 3 chunks" });
        await dongle.client.sendFragmentedData(uuidBytes);
        
        toast.message("Waiting for License...", { description: "Reading 256 bytes..." });
        const licenseBuffer = await dongle.client.receiveFragmentedData();
        
        const licenseHex = toHex(licenseBuffer);
        setLicenseData(licenseHex);
        toast.success("License Generated Successfully!");
        setCurrentStep(4);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error("License Generation Failed: " + message);
    } finally {
        setIsProcessing(false);
    }
  };

  // Step 4: Write License (Manual)
  const handleWriteLicense = () => {
     toast.info("Please use the Target Device controls below to write the license manually.");
  };

  const steps = [
    { id: 1, title: "Connect Dongle", icon: Usb },
    { id: 2, title: "Read UUID", icon: Key },
    { id: 3, title: "Generate License", icon: FileJson },
    { id: 4, title: "Write License", icon: ArrowRight },
  ];

  // Filter logs by device type for the target logs tab
  const targetLogs = logs.filter(log => log.message.startsWith('[Target]'));

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const Icon = step.icon;
            
            return (
                <div key={step.id} className={`flex flex-col items-center space-y-2 ${isActive ? 'text-primary' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-primary bg-primary/10' : isCompleted ? 'border-muted-foreground bg-muted' : 'border-muted-foreground/30'}`}>
                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-medium">{step.title}</span>
                </div>
            );
        })}
      </div>

      <Separator />

      <Card>
        <CardHeader>
            <CardTitle>
                {currentStep === 1 && "Connect License Dongle"}
                {currentStep === 2 && "Target Device UUID"}
                {currentStep === 3 && "Generate License"}
                {currentStep === 4 && "Write License to Target"}
            </CardTitle>
            <CardDescription>
                {currentStep === 1 && "Connect the STM32 Nucleo Dongle via USB."}
                {currentStep === 2 && "Read the 128-byte UUID from the target device."}
                {currentStep === 3 && "Send UUID to Dongle to receive the signed license."}
                {currentStep === 4 && "Transfer the generated license back to the target device."}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            
            {/* Step 1: Connect */}
            {currentStep === 1 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                        <div className={`w-3 h-3 rounded-full ${dongle.connectionState.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="flex-1">
                            <p className="font-medium">Status: {dongle.connectionState.isConnected ? 'Connected' : 'Disconnected'}</p>
                            {dongle.connectionState.device && <p className="text-xs text-muted-foreground">{dongle.connectionState.device.productName}</p>}
                            {dongle.connectionState.error && <p className="text-xs text-red-500">{dongle.connectionState.error}</p>}
                        </div>
                        {!dongle.connectionState.isConnected ? (
                            <Button onClick={handleConnect}>Select Device</Button>
                        ) : (
                            <Button variant="outline" onClick={dongle.disconnect}>Disconnect</Button>
                        )}
                    </div>
                    
                    <Button 
                        disabled={!dongle.connectionState.isConnected || isProcessing} 
                        onClick={handleTestConnection} 
                        className="w-full"
                    >
                        {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
                        Test Connection (Get Counter)
                    </Button>
                </div>
            )}

            {/* Step 2: UUID */}
            {currentStep === 2 && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleReadUUID} className="flex-1">
                            Read from Device
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <Label>UUID (Hex, 128 bytes)</Label>
                        <textarea 
                            className="w-full h-32 p-2 text-xs font-mono border rounded-md"
                            value={uuidInput}
                            onChange={(e) => setUuidInput(e.target.value)}
                        />
                         <p className="text-xs text-muted-foreground text-right">{uuidInput.length / 2} bytes</p>
                    </div>
                    <Button className="w-full" onClick={handleConfirmUUID}>Next: Generate License</Button>
                </div>
            )}

            {/* Step 3: Generate */}
            {currentStep === 3 && (
                <div className="space-y-4">
                     <Alert>
                        <Key className="h-4 w-4" />
                        <AlertTitle>Ready to Sign</AlertTitle>
                        <AlertDescription>
                            We will send the UUID to the dongle in 3 fragments and wait for the 256-byte license.
                        </AlertDescription>
                     </Alert>
                     
                     <div className="p-4 border rounded-md bg-muted/20 font-mono text-xs break-all">
                        <span className="font-bold text-muted-foreground">UUID:</span> {uuidInput.slice(0, 32)}...
                     </div>

                     <Button 
                        className="w-full" 
                        size="lg" 
                        disabled={isProcessing}
                        onClick={handleGenerateLicense}
                     >
                         {isProcessing ? (
                             <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Communicating...
                             </>
                         ) : (
                             "Generate License"
                         )}
                     </Button>
                </div>
            )}
            
            {/* Step 4: Write */}
            {currentStep === 4 && (
                <div className="space-y-4">
                    <Label>Generated License (256 bytes)</Label>
                    <textarea 
                        readOnly
                        className="w-full h-32 p-2 text-xs font-mono border rounded-md bg-muted"
                        value={licenseData}
                    />
                    <Button 
                        className="w-full" 
                        onClick={handleWriteLicense}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="animate-spin mr-2" /> : null}
                        Write to Target Device
                    </Button>
                    
                    <Button variant="ghost" className="w-full" onClick={() => setCurrentStep(2)}>
                        Start Over
                    </Button>
                </div>
            )}

        </CardContent>
      </Card>

      {/* Target Device Interaction Area */}
      <Card>
          <CardHeader>
              <CardTitle>Target Device Interaction</CardTitle>
              <CardDescription>
                  Manually interact with the target device to read UUID and write License.
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                  <div className={`w-3 h-3 rounded-full ${target.connectionState.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1">
                      <p className="font-medium">Status: {target.connectionState.isConnected ? `Connected` : 'Disconnected'}</p>
                  </div>
                  {!target.connectionState.isConnected ? (
                      <Button onClick={handleConnectTarget}>Connect Target Device</Button>
                  ) : (
                      <Button variant="outline" onClick={handleDisconnectTarget}>Disconnect</Button>
                  )}
              </div>

              {target.connectionState.isConnected && (
                  <div className="space-y-4">
                      <div className="flex space-x-2 border-b pb-2">
                          <Button 
                              variant={activeTab === 'report' ? 'default' : 'ghost'} 
                              size="sm" 
                              onClick={() => setActiveTab('report')}
                          >
                              Send Report
                          </Button>
                          <Button 
                              variant={activeTab === 'feature' ? 'default' : 'ghost'} 
                              size="sm" 
                              onClick={() => setActiveTab('feature')}
                          >
                              Send Feature Report
                          </Button>
                          <Button 
                              variant={activeTab === 'logs' ? 'default' : 'ghost'} 
                              size="sm" 
                              onClick={() => setActiveTab('logs')}
                          >
                              Logs
                          </Button>
                      </div>
                      
                      {activeTab === 'report' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-4 gap-4">
                                  <div className="col-span-1">
                                      <Label>Report ID (Hex)</Label>
                                      <Input value={reportIdInput} onChange={e => setReportIdInput(e.target.value)} />
                                  </div>
                                  <div className="col-span-3">
                                      <Label>Data (Hex)</Label>
                                      <Input value={reportDataInput} onChange={e => setReportDataInput(e.target.value)} placeholder="00 11 22..." />
                                  </div>
                              </div>
                              <Button onClick={handleSendReport}>Send Report</Button>
                          </div>
                      )}

                      {activeTab === 'feature' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-4 gap-4">
                                  <div className="col-span-1">
                                      <Label>Report ID (Hex)</Label>
                                      <Input value={featureReportIdInput} onChange={e => setFeatureReportIdInput(e.target.value)} />
                                  </div>
                                  <div className="col-span-3">
                                      <Label>Data (Hex)</Label>
                                      <Input value={featureReportDataInput} onChange={e => setFeatureReportDataInput(e.target.value)} placeholder="00 11 22..." />
                                  </div>
                              </div>
                              <Button onClick={handleSendFeatureReport}>Send Feature Report</Button>
                          </div>
                      )}

                      {activeTab === 'logs' && (
                          <div>
                              <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                  {targetLogs.map((log) => (
                                      <div key={log.id} className="text-xs font-mono mb-1">
                                          <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                          <span className={log.type === 'tx' ? 'text-blue-500' : 'text-green-500'}>
                                              {log.type === 'tx' ? ' -> ' : ' <- '}
                                          </span>
                                          {log.message.replace('[Target] ', '')}
                                      </div>
                                  ))}
                              </ScrollArea>
                              <Button variant="ghost" size="sm" onClick={clearLogs} className="mt-2">Clear Logs</Button>
                          </div>
                      )}
                  </div>
              )}
          </CardContent>
      </Card>
    </div>
  );
}
