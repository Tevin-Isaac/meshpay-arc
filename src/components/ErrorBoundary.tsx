import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Short name used in the message, for example "Chats". */
  area?: string
}

/** One broken screen must never take the whole wallet down. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Nothing is logged: error text can carry private data.
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="glass space-y-3 rounded-3xl p-5 text-center">
        <h2 className="display text-lg font-bold">{this.props.area ?? 'This screen'} hit a problem</h2>
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Your money and keys are safe. Try again, or switch to another tab.
        </p>
        <button
          onClick={() => this.setState({ failed: false })}
          className="min-h-11 rounded-2xl px-5 text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Try again
        </button>
      </section>
    )
  }
}
