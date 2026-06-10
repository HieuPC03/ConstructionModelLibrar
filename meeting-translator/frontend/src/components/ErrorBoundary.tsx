import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Meeting Translator UI error:", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>Giao diện gặp lỗi</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={this.reload}>
            Tải lại ứng dụng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
