import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 w-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 rounded-2xl shadow-sm my-6 text-center max-w-2xl mx-auto">
          <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-full text-red-600 dark:text-red-400 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
            An unexpected error occurred while rendering this component. This
            could be due to missing data or database connectivity issues.
          </p>
          {this.state.error && (
            <div className="w-full text-left bg-gray-50 dark:bg-slate-950 border border-gray-150 dark:border-slate-850 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
              <p className="font-mono text-xs text-red-650 dark:text-red-400 break-all whitespace-pre-wrap">
                {this.state.error.stack || this.state.error.message}
              </p>
            </div>
          )}
          <div className="flex items-center gap-4 justify-center">
            <button
              onClick={this.handleReset}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all text-sm cursor-pointer"
            >
              Back to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-700 font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all text-sm cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
