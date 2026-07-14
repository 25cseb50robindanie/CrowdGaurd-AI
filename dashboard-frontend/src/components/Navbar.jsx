import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Navbar({ onTriggerCriticalAlert, activeAlertsCount }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/';

  const handleScrollTo = (elementId) => {
    if (!isDashboard) {
      // Navigate home first, then scroll
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(elementId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="flex justify-between items-center w-full px-margin-desktop h-16 bg-surface-container-low border-b border-outline-variant sticky top-0 z-50 shrink-0">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container shadow-md group-hover:opacity-90">
            <span className="material-symbols-outlined text-xl">shield</span>
          </div>
          <div>
            <span className="font-headline-md text-headline-md font-bold text-on-surface">CrowdGuard AI</span>
          </div>
        </Link>
        
        <nav className="hidden lg:flex space-x-6">
          <Link 
            to="/" 
            className={`font-label-caps text-label-caps transition-colors pb-1 ${
              isDashboard 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Dashboard
          </Link>
          
          <button 
            onClick={() => handleScrollTo('cameras-section')}
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors pb-1"
          >
            Cameras
          </button>
          
          <button 
            onClick={() => handleScrollTo('alerts-section')}
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors pb-1 relative"
          >
            Alerts
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 w-1.5 h-1.5 bg-error rounded-full risk-pulse"></span>
            )}
          </button>
          
          <Link 
            to="/reports" 
            className={`font-label-caps text-label-caps transition-colors pb-1 ${
              location.pathname === '/reports' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            Reports
          </Link>
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        {/* Developer Trigger Badge for Critical Alert Modal */}
        <button
          onClick={onTriggerCriticalAlert}
          className="px-3 py-1 bg-error-container/20 border border-error/50 hover:bg-error-container/40 text-error rounded text-[10px] font-label-caps uppercase tracking-wider transition-all"
          title="Trigger a Critical Alert Modal overlay for verification"
        >
          🚨 Trigger Critical
        </button>

        <div className="hidden sm:flex flex-col items-end mr-2">
          <span className="font-label-caps text-[10px] text-primary uppercase tracking-widest">System Active</span>
          <span className="font-body-md text-on-surface-variant text-xs">Temple Complex — Zone A</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">schedule</span>
          </button>
        </div>

        <div className="h-8 w-8 rounded-full border border-outline overflow-hidden">
          <img 
            className="w-full h-full object-cover" 
            alt="Security Officer S. Kumar" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuByxVQazxasTuCmP1EdjPxRdqqRcZXa-X072FXdGLoaTaDBxb0TYu7hgERLQ1P0rcPBV5zBvaOCLtG75jFZThxE1l-j0AABk_6H5iSNgmDOCgTUInmiM5FBd1P_Ot-uB0wWpXZRSjMJUgwmUh6hIjqsmmgKmgRrca23JIFItELbZFqeNKRbB9aqcgjf6lIzZbk43NbCmH1BwqMR5jka-E-LICJgrVV83_RaJvnWX2AXKvX9qr9bibiXrKZKKB8RB3GcFSNFUQzosCCM"
          />
        </div>
      </div>
    </header>
  );
}
