'use client';

import { HIDProvider } from "@/lib/hid/hid-context";
import { DebugConsole } from "@/components/debug-console";
import { LicenseFlow } from "@/components/license-flow";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <HIDProvider>
        <main className="min-h-screen bg-background flex flex-col font-sans">
          <div className="flex-1 container mx-auto p-4 md:p-8 max-w-3xl">
             <header className="mb-8 text-center space-y-4">
               <h1 className="text-2xl font-bold tracking-tight">ORO License Tool</h1>
               <p className="text-muted-foreground">
                 Offline license generation for Target Devices via STM32 Dongle.
               </p>
               
               <div className="flex gap-2 justify-center">
                 <Link href="/auto-license">
                   <Button variant="outline">
                     Go to Automated Process →
                   </Button>
                 </Link>
               </div>
             </header>

             <LicenseFlow />
          </div>

          <DebugConsole />
        </main>
    </HIDProvider>
  );
}
