import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0A0A0B] text-[#E1E1E6] font-mono">
          <div className="glass-panel p-6 max-w-lg w-full rounded-sm border border-red-500/30 text-center space-y-4">
            <AlertTriangle size={36} className="text-red-400 mx-auto" />
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              {this.props.fallbackTitle || "Runtime Component Exception Intercepted"}
            </h3>
            <p className="text-xs text-[#8E8E93] break-words">
              {this.state.error?.message || "An unexpected rendering fault occurred."}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 bg-[#161618] hover:bg-[#202024] border border-[#2D2D30] text-[#00FF9C] px-4 py-2 rounded-sm text-xs transition-colors"
            >
              <RefreshCw size={12} />
              RESET COMPONENT STATE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
