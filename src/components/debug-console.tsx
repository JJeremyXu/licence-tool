'use client';

import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useHID } from '@/lib/hid/hid-context';
import { LogEntry } from '@/lib/hid/types';

export function DebugConsole() {
  const { logs, clearLogs } = useHID();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }
  }, [logs]);

  const getVariant = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'success': return 'default'; // dark
      case 'rx': return 'secondary';
      case 'tx': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="border-t bg-muted/30 p-4 h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">Debug Console</h3>
        <button 
            onClick={clearLogs}
            className="text-xs text-muted-foreground hover:text-foreground"
        >
            Clear
        </button>
      </div>
      <ScrollArea className="flex-1 rounded-md border bg-background p-4 font-mono text-xs" ref={scrollRef}>
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2">
               <span className="text-muted-foreground min-w-[70px]">
                 {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
               </span>
               <Badge variant={getVariant(log.type)} className="h-5 px-1 text-[10px] uppercase min-w-[50px] justify-center">
                  {log.type}
               </Badge>
               <span className="flex-1 break-all">
                 {log.message}
                 {log.data && <span className="block text-muted-foreground opacity-70 mt-0.5 ml-2">{log.data}</span>}
               </span>
            </div>
          ))}
          {logs.length === 0 && (
             <div className="text-muted-foreground italic">No logs yet.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
