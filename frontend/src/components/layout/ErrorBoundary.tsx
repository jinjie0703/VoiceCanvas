import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Result, Button } from "antd";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-slate-50">
          <Result
            status="error"
            title="UI 渲染崩溃"
            subTitle={this.state.error?.message || "发生了未知的渲染错误，通常由不受支持的数据格式导致。"}
            extra={[
              <Button type="primary" key="console" onClick={() => window.location.reload()}>
                刷新页面重试
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
