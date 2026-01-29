'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useHID } from '@/lib/hid/hid-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DebugConsole } from '@/components/debug-console';
import { Usb, CheckCircle2, XCircle, Loader2, PlayCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

type ProcessStep = 'idle' | 'get-uuid' | 'get-counter' | 'generate-license' | 'write-license' | 'complete' | 'error';

export default function AutoLicensePage() {
  const { dongle, target } = useHID();
  const [counter, setCounter] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<ProcessStep>('idle');
  const [progress, setProgress] = useState(0);
  const [uuid, setUuid] = useState<Uint8Array | null>(null);
  const [license, setLicense] = useState<Uint8Array | null>(null);

  const handleConnectDongle = async () => {
    try {
      await dongle.connect();
      toast.success('License Dongle connected');
    } catch (e) {
      const error = e as Error;
      toast.error('Failed to connect Dongle: ' + error.message);
    }
  };

  const handleConnectTarget = async () => {
    try {
      await target.connect();
      toast.success('Target Device connected');
    } catch (e) {
      const error = e as Error;
      toast.error('Failed to connect Target Device: ' + error.message);
    }
  };

  const handleCheckCounter = useCallback(async () => {
    if (!dongle.client) {
      toast.error('Dongle not connected');
      return;
    }

    try {
      const counterValue = await dongle.client.getCounter();
      if (counterValue !== null) {
        setCounter(counterValue);
        toast.success(`Counter: ${counterValue}`);
      } else {
        toast.error('Failed to read counter');
      }
    } catch (e) {
      const error = e as Error;
      toast.error('Counter check failed: ' + error.message);
    }
  }, [dongle.client]);

  useEffect(() => {
    if (dongle.connectionState.isConnected && dongle.client) {
      handleCheckCounter();
    }
  }, [dongle.connectionState.isConnected, dongle.client, handleCheckCounter]);

  const handleStartProcess = async () => {
    if (!dongle.client || !target.client) {
      toast.error('Please connect both devices first');
      return;
    }

    if (counter === null || counter <= 0) {
      toast.error('License counter must be greater than 0');
      return;
    }

    try {
      // Step 1: Get UUID from Device
      setCurrentStep('get-uuid');
      setProgress(25);
      toast.info('Step 1: Reading UUID from device (0x80 -> 0x81)...');
      const deviceUuid = await target.client.readUUID();
      setUuid(deviceUuid);

      // Step 2: Get Counter (already done, but refresh)
      setCurrentStep('get-counter');
      setProgress(40);
      toast.info('Step 2: Checking counter...');
      const newCounter = await dongle.client.getCounter();
      if (newCounter === null || newCounter <= 0) {
        throw new Error('Counter check failed or no licenses available');
      }
      setCounter(newCounter);

      // Step 3: Generate License from Dongle
      setCurrentStep('generate-license');
      setProgress(60);
      toast.info('Step 3: Generating license...');
      
      await dongle.client.sendFragmentedData(deviceUuid);
      const generatedLicense = await dongle.client.receiveFragmentedData();
      setLicense(generatedLicense);

      // Step 4: Write License to Device
      setCurrentStep('write-license');
      setProgress(85);
      toast.info('Step 4: Writing license to device...');
      await target.client.writeLicense(generatedLicense);

      // Complete
      setCurrentStep('complete');
      setProgress(100);
      toast.success('License process completed successfully! 🎉');

    } catch (e) {
      const error = e as Error;
      setCurrentStep('error');
      toast.error('Process failed: ' + error.message);
      console.error('License process error:', e);
    }
  };

  const isReady = dongle.connectionState.isConnected && target.connectionState.isConnected && counter !== null && counter > 0;
  const isProcessing = currentStep !== 'idle' && currentStep !== 'complete' && currentStep !== 'error';

  return (
    <main className="min-h-screen bg-background flex flex-col font-sans">
      <div className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Automated License Process</h1>
          <p className="text-muted-foreground">
            One-click license generation with real-time progress tracking.
          </p>
        </header>

        {/* Device Connection Status */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Usb className="w-4 h-4" />
                License Dongle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={dongle.connectionState.isConnected ? 'default' : 'secondary'}>
                  {dongle.connectionState.isConnected ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" /> Disconnected</>
                  )}
                </Badge>
              </div>
              {dongle.connectionState.isConnected && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Counter:</span>
                  <Badge variant={counter !== null && counter > 0 ? 'default' : 'destructive'}>
                    {counter ?? '—'}
                  </Badge>
                </div>
              )}
              <div className="flex gap-2">
                {!dongle.connectionState.isConnected ? (
                  <Button size="sm" onClick={handleConnectDongle} className="flex-1">
                    Connect
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleCheckCounter} className="flex-1">
                    Refresh Counter
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Usb className="w-4 h-4" />
                Target Device
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={target.connectionState.isConnected ? 'default' : 'secondary'}>
                  {target.connectionState.isConnected ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" /> Disconnected</>
                  )}
                </Badge>
              </div>
              <Button 
                size="sm" 
                onClick={handleConnectTarget} 
                disabled={target.connectionState.isConnected}
                className="w-full"
              >
                {target.connectionState.isConnected ? 'Connected' : 'Connect'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Process Control */}
        <Card>
          <CardHeader>
            <CardTitle>License Generation Process</CardTitle>
            <CardDescription>
              Automated workflow: Get UUID → Check Counter → Generate License → Write to Device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isReady && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Setup Required</AlertTitle>
                <AlertDescription>
                  {!dongle.connectionState.isConnected && '• Connect License Dongle\n'}
                  {!target.connectionState.isConnected && '• Connect Target Device\n'}
                  {dongle.connectionState.isConnected && (counter === null || counter <= 0) && '• Check counter (must be > 0)'}
                </AlertDescription>
              </Alert>
            )}

            {currentStep !== 'idle' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {currentStep === 'get-uuid' && 'Reading UUID...'}
                    {currentStep === 'get-counter' && 'Checking Counter...'}
                    {currentStep === 'generate-license' && 'Generating License...'}
                    {currentStep === 'write-license' && 'Writing License...'}
                    {currentStep === 'complete' && 'Complete!'}
                    {currentStep === 'error' && 'Error'}
                  </span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <Button 
              size="lg"
              className="w-full"
              disabled={!isReady || isProcessing}
              onClick={handleStartProcess}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Start License Process
                </>
              )}
            </Button>

            {currentStep === 'complete' && (
              <Alert className="border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                  License has been successfully generated and written to the device.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Process Details */}
        {(uuid || license) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Process Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uuid && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">UUID (128 bytes)</span>
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all">
                    {Array.from(uuid).map(b => b.toString(16).padStart(2, '0')).join(' ')}
                  </div>
                </div>
              )}
              {license && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">License (256 bytes)</span>
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all max-h-32 overflow-y-auto">
                    {Array.from(license).map(b => b.toString(16).padStart(2, '0')).join(' ')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <DebugConsole />
    </main>
  );
}
