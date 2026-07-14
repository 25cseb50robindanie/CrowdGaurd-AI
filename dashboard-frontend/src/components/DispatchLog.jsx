import React from 'react';

export default function DispatchLog({ logs }) {
  return (
    <div className="bg-surface-container border border-outline-variant rounded p-5 flex flex-col h-full min-h-[220px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-sm">assignment</span>
          Dispatch Activity Log
        </h3>
        <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase">
          {logs.length} EVENTS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2 pr-1 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-on-surface-variant/40 text-xs italic font-body-md py-4">
            No active dispatch actions logged.
          </div>
        ) : (
          [...logs].reverse().map((log) => (
            <div 
              key={log.id} 
              className="p-2.5 rounded bg-surface-container-low border border-outline-variant flex justify-between items-start gap-3 hover:border-error/30 transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-error risk-pulse"></span>
                  <span className="font-label-caps text-[10px] text-error font-bold uppercase">Force Dispatched</span>
                </div>
                <p className="font-body-md text-xs text-on-surface truncate">
                  {log.zone}
                </p>
                <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                  {log.message}
                </p>
              </div>
              <span className="font-data-table text-[10px] text-primary whitespace-nowrap bg-primary-container/10 px-1.5 py-0.5 rounded">
                {log.timestamp}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
