"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class HostPlayerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[HostPlayerErrorBoundary] Error caught:', error);
    console.error('[HostPlayerErrorBoundary] Error info:', errorInfo);
    console.error('[HostPlayerErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="w-full p-6 bg-red-900/20 border border-red-500/50 rounded-[24px]">
            <h3 className="text-red-400 font-bold mb-2">HostPlayer Crashed</h3>
            <p className="text-red-300 text-sm mb-2">Error: {this.state.error?.message}</p>
            <pre className="text-red-200 text-xs overflow-auto max-h-40">
              {this.state.error?.stack}
            </pre>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
