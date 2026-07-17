import React, { useState, useEffect, useRef } from 'react';

export default function VideoPlayer({ camera }) {
  const [showAiLayers, setShowAiLayers] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Connecting to live camera...");
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setLoadingMessage("Connecting to live camera...");
    
    const cycleMessages = [
      "Connecting to live camera...",
      "Initializing AI detection...",
      "Configuring YOLO tracker...",
      "Receiving live video frames..."
    ];
    let idx = 0;
    const msgInterval = setInterval(() => {
      if (idx < cycleMessages.length - 1) {
        idx++;
        setLoadingMessage(cycleMessages[idx]);
      }
    }, 2500);

    const timeoutId = setTimeout(() => {
      setIsLoading((loading) => {
        if (loading) {
          setHasError(true);
        }
        return loading;
      });
    }, 15000); // 15 seconds connection timeout

    return () => {
      clearInterval(msgInterval);
      clearTimeout(timeoutId);
    };
  }, [camera.streamUrl]);

  const handleMediaLoad = () => {
    setIsLoading(false);
  };

  const handleMediaError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div 
      ref={containerRef}
      className={`aspect-video bg-surface-container-lowest border-2 border-error relative group rounded overflow-hidden flex items-center justify-center transition-all duration-300 ${
        isFullscreen ? 'w-screen h-screen' : ''
      }`}
    >
      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 z-30 bg-surface-container-lowest/90 flex flex-col items-center justify-center gap-3 transition-all duration-300">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-on-surface-variant font-medium animate-pulse">{loadingMessage}</span>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 z-30 bg-surface-container-lowest flex flex-col items-center justify-center gap-3 p-6 text-center transition-all duration-300">
          <span className="material-symbols-outlined text-error text-3xl">videocam_off</span>
          <span className="text-xs font-semibold text-on-surface">Camera Connection Failed</span>
          <span className="text-[11px] text-on-surface-variant max-w-xs leading-relaxed">
            Unable to receive live stream. The AI detection worker might still be starting or the video source is unreachable.
          </span>
        </div>
      )}

      {/* video element / live MJPEG stream */}
      {camera.streamUrl && camera.streamUrl.includes('/stream') ? (
        <img
          key={camera.streamUrl}
          src={camera.streamUrl}
          onLoad={handleMediaLoad}
          onError={handleMediaError}
          className="w-full h-full object-cover opacity-80 absolute inset-0 transition-opacity duration-300"
          alt="Live Video Stream"
        />
      ) : (
        <video
          ref={videoRef}
          key={camera.streamUrl} // forces re-render/reload when switching camera
          src={camera.streamUrl}
          onCanPlay={handleMediaLoad}
          onError={handleMediaError}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-60 absolute inset-0 transition-opacity duration-300"
        />
      )}

      {/* AI Bounding Boxes Overlay (Rendered dynamically from swappable Mock Data configuration) */}
      {showAiLayers && camera.boundingBoxes && (
        <div className="absolute inset-0 z-10 pointer-events-none p-6">
          {camera.boundingBoxes.map((box) => (
            <div 
              key={box.id} 
              className="absolute"
              style={box.style}
            >
              <span className={`${box.badgeStyle} font-label-caps text-[10px] px-1 absolute -top-5 left-0 whitespace-nowrap`}>
                {box.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Camera Live Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-3 pointer-events-none">
        <span className="bg-error px-2 py-0.5 rounded text-[10px] font-bold text-on-error flex items-center risk-pulse">
          <span className="w-1.5 h-1.5 bg-on-error rounded-full mr-1.5"></span> LIVE
        </span>
        <span className="bg-surface-container/80 backdrop-blur-md px-3 py-1 rounded text-xs font-data-display border border-outline-variant text-on-surface">
          {camera.streamLabel}
        </span>
      </div>

      {/* Video Actions overlay on hover */}
      <div className="absolute bottom-4 right-4 z-20 flex space-x-2">
        <button 
          onClick={() => setShowAiLayers(!showAiLayers)}
          className="bg-surface-container/80 backdrop-blur-md px-3 py-1.5 rounded text-[10px] font-label-caps text-on-surface border border-outline-variant hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-xs">analytics</span>
          {showAiLayers ? 'HIDE AI' : 'SHOW AI'}
        </button>
        <button 
          onClick={handleToggleFullscreen}
          className="bg-surface-container/80 backdrop-blur-md p-2 rounded border border-outline-variant text-on-surface hover:bg-primary hover:text-on-primary transition-all flex items-center"
        >
          <span className="material-symbols-outlined text-sm">
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>
      </div>
    </div>
  );
}
