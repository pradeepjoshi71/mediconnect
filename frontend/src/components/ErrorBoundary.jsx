import { Component } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

// ─── Silent auto-reporter ─────────────────────────────────────────────────────
// Posts the JS error to /api/beta-feedback without blocking the fallback UI.
// Uses raw fetch (not axios) so it works even if the axios instance is broken.
async function silentlyReportError(error, componentStack) {
  try {
    const token = localStorage.getItem("accessToken");
    const tenantId = localStorage.getItem("tenantId");
    const userId = localStorage.getItem("userId");
    const role = localStorage.getItem("role");

    await fetch("/api/beta-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        tenantId: tenantId ? Number(tenantId) : null,
        userId: userId ? Number(userId) : null,
        role: role || "unknown",
        issueType: "bug",
        description: [
          `[AUTO] Uncaught React Error: ${error?.message || "Unknown error"}`,
          "",
          "── Error Stack ──",
          error?.stack || "No stack available",
          "",
          "── Component Stack ──",
          componentStack || "Not available",
        ].join("\n").slice(0, 5000),
        screenRoute: window.location.pathname,
      }),
      // Best-effort — 8s timeout, no retry
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Silently discard — the error boundary's job is to show the UI, not to retry
  }
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
      retryCount: 0,
    };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleGoHome = this.handleGoHome.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Fire-and-forget — never await in componentDidCatch
    silentlyReportError(error, errorInfo?.componentStack).then(() => {
      this.setState({ reported: true });
    });

    // Also log to console so devs see it in browser DevTools
    console.error("[ErrorBoundary] Caught unhandled error:", error, errorInfo);
  }

  handleRetry() {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
      retryCount: prev.retryCount + 1,
    }));
  }

  handleGoHome() {
    window.location.href = "/dashboard";
  }

  render() {
    if (!this.state.hasError) {
      // Key on retryCount so React fully remounts children on retry
      return (
        <div key={this.state.retryCount}>
          {this.props.children}
        </div>
      );
    }

    const { error, reported, retryCount } = this.state;
    const isRepeatFailure = retryCount >= 2;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
        {/* Ambient background pulse */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-400/5 dark:bg-blue-500/5 blur-3xl animate-pulse" />
        </div>

        <div className="relative w-full max-w-md">
          {/* Card */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/60 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 p-8">

            {/* Icon + badge */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500 dark:text-amber-400" strokeWidth={1.5} />
                </div>
                {/* Medical cross accent */}
                <span className="absolute -top-1.5 -right-1.5 text-base leading-none select-none">🏥</span>
              </div>

              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                A minor system glitch occurred
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                The page ran into an unexpected issue. Your patient data is safe
                and unaffected. Our engineering team has been automatically notified.
              </p>
            </div>

            {/* Auto-report badge */}
            <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-6 text-xs font-medium transition-all duration-500 ${
              reported
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
                : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40"
            }`}>
              <Bug className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {reported
                  ? "Bug report sent to the dev team ✓"
                  : "Sending bug report to the dev team…"}
              </span>
            </div>

            {/* Error detail (collapsed by default) */}
            {error?.message && (
              <details className="mb-6 group">
                <summary className="cursor-pointer text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors select-none list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 inline-block transition-transform duration-200">▶</span>
                  Technical details
                </summary>
                <div className="mt-2 p-3 bg-slate-900 dark:bg-black/60 rounded-xl border border-slate-700/40">
                  <code className="text-xs text-red-400 font-mono break-all leading-relaxed whitespace-pre-wrap">
                    {error.message}
                  </code>
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              {!isRepeatFailure ? (
                <button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition-all duration-150 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </button>
              ) : (
                <p className="text-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                  The error is persisting — please use the button below.
                </p>
              )}

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all duration-150"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>

            {/* Footer */}
            <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-600 leading-snug">
              If this keeps happening, contact support at{" "}
              <a
                href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || "support@mediconnect.app"}`}
                className="underline hover:text-blue-500 transition-colors"
              >
                {import.meta.env.VITE_SUPPORT_EMAIL || "support@mediconnect.app"}
              </a>
            </p>
          </div>

          {/* Screen path watermark for devs */}
          <p className="mt-3 text-center text-[10px] text-slate-400/50 font-mono">
            {window.location.pathname}
          </p>
        </div>
      </div>
    );
  }
}
