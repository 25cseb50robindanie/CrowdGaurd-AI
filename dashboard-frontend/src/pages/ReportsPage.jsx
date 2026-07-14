import React, { useState } from 'react';
import { mockHistoricalAlerts } from '../mockData';

export default function ReportsPage({ onAddToast }) {
  const [accurateSelected, setAccurateSelected] = useState(null); // 'yes' or 'no'
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const getRiskBadge = (level) => {
    switch (level) {
      case 'red':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-error-container/20 text-error border border-error-container">
            Red Risk
          </span>
        );
      case 'amber':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
            Amber Risk
          </span>
        );
      case 'green':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary-container/10 text-primary border border-primary-container/30">
            Green Risk
          </span>
        );
    }
  };

  const getStatusDisplay = (status) => {
    if (status === 'Dispatched') {
      return (
        <span className="flex items-center gap-1.5 text-on-surface">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          Dispatched
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-on-surface-variant">
        <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
        Resolved
      </span>
    );
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (accurateSelected === null) {
      onAddToast("Please select accuracy feedback before submitting.");
      return;
    }
    
    // Trigger toast feedback
    onAddToast("Review submitted to Command Staff.");

    // Post review data to FastAPI backend (Person C)
    fetch('http://localhost:8000/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_accurate: accurateSelected === 'yes',
        notes: feedbackNotes
      })
    })
    .catch((err) => {
      // Backend endpoint not active yet; ignore silently
    });

    setFeedbackNotes('');
    setAccurateSelected(null);
  };

  return (
    <div className="max-w-container-max mx-auto space-y-6 p-margin-desktop">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">Reports &amp; History</h1>
          <p className="font-body-md text-on-surface-variant">
            Review archival incident data and response metrics for the current operational cycle.
          </p>
        </div>
      </div>

      {/* Grid Layout for History and Feedback */}
      <div className="grid grid-cols-12 gap-gutter">
        
        {/* Historical Table Component (Spans 12 columns) */}
        <div className="col-span-12 bg-surface-container-low card-outline rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h3 className="font-label-caps text-label-caps text-primary uppercase tracking-widest">
              Historical Alert Logs
            </h3>
            <span className="font-data-table text-on-surface-variant text-xs">
              Showing active logs database
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-lowest text-on-surface-variant font-label-caps text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-b border-outline-variant">Incident ID</th>
                  <th className="px-6 py-4 border-b border-outline-variant">Zone Name</th>
                  <th className="px-6 py-4 border-b border-outline-variant">Timestamp</th>
                  <th className="px-6 py-4 border-b border-outline-variant">Risk Level</th>
                  <th className="px-6 py-4 border-b border-outline-variant">Resolution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-data-table text-xs text-on-surface">
                {mockHistoricalAlerts.map((row) => (
                  <tr 
                    key={row.id} 
                    className="hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-on-surface-variant font-mono">{row.id}</td>
                    <td className="px-6 py-4 font-semibold text-on-surface">{row.zoneName}</td>
                    <td className="px-6 py-4">{row.timestamp}</td>
                    <td className="px-6 py-4">{getRiskBadge(row.riskLevel)}</td>
                    <td className="px-6 py-4">{getStatusDisplay(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feedback & Review Form (Spans 12 columns) */}
        <div className="col-span-12 bg-surface-container card-outline rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -right-20 -top-20 w-48 h-48 bg-primary/5 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Feedback &amp; Review</h3>
              <p className="font-body-md text-on-surface-variant">
                Post-incident verification to enhance AI detection accuracy.
              </p>
            </div>
            
            <div className="bg-surface-container-low card-outline p-1 rounded-lg flex items-center gap-2">
              <span className="font-label-caps text-[10px] px-3 text-on-surface-variant whitespace-nowrap">
                Was last detection accurate?
              </span>
              <button 
                type="button"
                onClick={() => setAccurateSelected('yes')}
                className={`px-4 py-1.5 rounded-md font-label-caps text-label-caps transition-all ${
                  accurateSelected === 'yes'
                    ? 'bg-primary text-on-primary font-bold'
                    : 'bg-primary-container/10 text-primary hover:bg-primary-container/20'
                }`}
              >
                Yes
              </button>
              <button 
                type="button"
                onClick={() => setAccurateSelected('no')}
                className={`px-4 py-1.5 rounded-md font-label-caps text-label-caps transition-all ${
                  accurateSelected === 'no'
                    ? 'bg-error text-on-error font-bold'
                    : 'bg-error-container/10 text-error hover:bg-error-container/20'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitReview} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
            <div className="md:col-span-3">
              <textarea 
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Enter short review notes or discrepancy details here..."
                className="w-full h-24 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-body-md text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50"
              ></textarea>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                type="submit"
                className="w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-bold font-label-caps text-label-caps shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                Submit Review
              </button>
              <p className="text-[10px] text-center mt-3 text-on-surface-variant/60 italic font-body-md">
                Note: Reviews are audited by Command Staff.
              </p>
            </div>
          </form>
        </div>

      </div>

      {/* Subtle Informational Footer */}
      <div className="flex flex-col md:flex-row justify-between items-center py-8 opacity-40 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-4 text-[10px] font-label-caps tracking-widest">
          <span>SYSTEM ID: CG-AI-7742</span>
          <span className="w-1 h-1 rounded-full bg-outline"></span>
          <span>ENCRYPTION: AES-256-GCM</span>
        </div>
        <div className="text-[10px] font-label-caps tracking-widest mt-4 md:mt-0">
          © 2026 CROWDGUARD AI SYSTEMS • V2.4.0-RELEASE
        </div>
      </div>
    </div>
  );
}
