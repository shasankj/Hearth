import { Component } from 'react';

// Error boundaries must be classes: they catch render-time errors in the tree below them.
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="crash">
        <h1>Something went wrong.</h1>
        <p>{this.state.error.message}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
