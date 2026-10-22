import { Component } from 'react'
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('App error:', error) } // hook error tracking in here
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="login"><div className="card">
        <b>Something went wrong.</b>
        <p>Your data is safe. Reload the page and try again. If it keeps happening, tell your developer what you were doing.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div></div>
    )
  }
}
