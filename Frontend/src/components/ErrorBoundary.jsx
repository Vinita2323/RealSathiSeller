import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Automatically reload on chunk loading error caused by new deployments
    const isChunkLoadError = 
      error?.name === 'TypeError' && 
      (error?.message?.includes('Failed to fetch dynamically imported module') || 
       error?.message?.includes('Importing a module script failed'));
                              
    if (isChunkLoadError) {
      const chunkFailedKey = 'sathiseller_chunk_failed_reload';
      if (!sessionStorage.getItem(chunkFailedKey)) {
        sessionStorage.setItem(chunkFailedKey, 'true');
        window.location.reload(true);
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-5">
            We encountered a temporary issue while loading this page. Please refresh or try again.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 bg-[#ff7526] hover:bg-[#e65507] text-white rounded-xl text-xs font-bold transition-all shadow-xs border-none cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
