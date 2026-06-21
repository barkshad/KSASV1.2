import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
        <h1 className="text-[120px] leading-none font-display-lg text-primary font-bold opacity-20">404</h1>
        <div className="space-y-2">
          <h2 className="font-headline-lg font-bold">Page Not Found</h2>
          <p className="font-body-md text-on-surface-variant">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 flex items-center justify-center gap-2 w-full h-12 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-container transition-colors"
        >
          <Home className="w-5 h-5" />
          Go Home
        </button>
      </div>
    </div>
  );
}
