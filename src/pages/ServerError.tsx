import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RefreshCcw } from 'lucide-react';

export default function ServerError() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
        <h1 className="text-[120px] leading-none font-display-lg text-error font-bold opacity-20">500</h1>
        <div className="space-y-2">
          <h2 className="font-headline-lg font-bold">Server Error</h2>
          <p className="font-body-md text-on-surface-variant">
            Something went wrong on our end. Please try again later.
          </p>
        </div>
        <div className="flex gap-4 mt-8">
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-surface-container-highest border border-outline-variant text-on-surface rounded-xl font-bold hover:bg-surface-variant transition-colors"
          >
            <RefreshCcw className="w-5 h-5" />
            Try Again
          </button>
          <button 
            onClick={() => navigate('/')}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-container transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
