import { useState, useRef, useEffect, useCallback } from "react";
import { Bug, X, Send, ChevronDown, CheckCircle, Loader2 } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  { value: "bug",             label: "🐛  Bug / Crash" },
  { value: "ui_glitch",      label: "🖥️  UI Glitch" },
  { value: "data_error",     label: "📊  Wrong Data" },
  { value: "performance",    label: "⚡  Slow / Laggy" },
  { value: "feature_request",label: "💡  Feature Request" },
  { value: "other",          label: "📝  Other" },
];

const MIN_DESC_LENGTH = 10;

// ─── API call ─────────────────────────────────────────────────────────────────

async function submitFeedback({ issueType, description }) {
  const token    = localStorage.getItem("accessToken");
  const tenantId = localStorage.getItem("tenantId");
  const userId   = localStorage.getItem("userId");
  const role     = localStorage.getItem("role");

  const res = await fetch("/api/beta-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      tenantId:    tenantId ? Number(tenantId) : null,
      userId:      userId   ? Number(userId)   : null,
      role:        role     || "unknown",
      issueType,
      description,
      screenRoute: window.location.pathname,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BetaFeedbackWidget() {
  const [open, setOpen]           = useState(false);
  const [issueType, setIssueType] = useState("bug");
  const [description, setDesc]    = useState("");
  const [status, setStatus]       = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg]   = useState("");
  const [minimised, setMinimised] = useState(false);

  const modalRef   = useRef(null);
  const textareaRef = useRef(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Trap focus inside modal when open (a11y)
  useEffect(() => {
    if (!open || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const trap  = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  const openModal = () => {
    setOpen(true);
    setMinimised(false);
    setStatus("idle");
    setErrorMsg("");
  };

  const closeModal = useCallback(() => {
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setDesc("");
      setIssueType("bug");
      setStatus("idle");
      setErrorMsg("");
    }, 300);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < MIN_DESC_LENGTH) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      await submitFeedback({ issueType, description: description.trim() });
      setStatus("success");
      // Auto-close after success
      setTimeout(closeModal, 2200);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to send. Please try again.");
    }
  };

  const isValid     = description.trim().length >= MIN_DESC_LENGTH;
  const charCount   = description.trim().length;
  const isSubmitting = status === "submitting";

  return (
    <>
      {/* ── Floating trigger button ────────────────────────────────────────── */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
        role="region"
        aria-label="Beta feedback"
      >
        <button
          onClick={openModal}
          aria-label="Open beta feedback form"
          aria-expanded={open}
          className={`
            group flex items-center gap-2 px-4 py-2.5 rounded-2xl
            bg-slate-900 dark:bg-slate-800
            border border-slate-700/60 dark:border-slate-600/60
            text-white text-xs font-semibold
            shadow-lg shadow-slate-900/30
            hover:bg-slate-800 dark:hover:bg-slate-700
            hover:shadow-xl hover:shadow-slate-900/40
            active:scale-95
            transition-all duration-200 ease-out
            ${open ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"}
          `}
        >
          <Bug className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
          <span className="tracking-wide">Beta Feedback</span>
          {/* Pulse dot — indicates active beta */}
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
          </span>
        </button>
      </div>

      {/* ── Modal backdrop ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Beta feedback form"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Subtle scrim — doesn't block the UI visually */}
          <div className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-[2px]" aria-hidden="true" />

          {/* ── Modal panel ──────────────────────────────────────────────── */}
          <div
            ref={modalRef}
            className={`
              relative w-full max-w-sm
              bg-white dark:bg-slate-900
              border border-slate-200/80 dark:border-slate-700/60
              rounded-3xl shadow-2xl shadow-slate-900/20 dark:shadow-slate-950/60
              transition-all duration-300 ease-out
              ${minimised ? "h-12 overflow-hidden" : ""}
              animate-in slide-in-from-bottom-4 fade-in duration-200
            `}
            style={{ marginBottom: "4.5rem" }} // clear the trigger button
          >

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center">
                  <Bug className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                    Beta Feedback
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">
                    {window.location.pathname}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimised((v) => !v)}
                  aria-label={minimised ? "Expand" : "Minimise"}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${minimised ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={closeModal}
                  aria-label="Close feedback form"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            {!minimised && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="px-5 py-4 space-y-4">

                  {/* Success state */}
                  {status === "success" && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center mb-3">
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Thank you!</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Your report has been sent to the dev team.<br />We'll look into it right away.
                      </p>
                    </div>
                  )}

                  {/* Form fields */}
                  {status !== "success" && (
                    <>
                      {/* Issue type */}
                      <div>
                        <label
                          htmlFor="beta-issue-type"
                          className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                        >
                          What's the issue?
                        </label>
                        <div className="relative">
                          <select
                            id="beta-issue-type"
                            value={issueType}
                            onChange={(e) => setIssueType(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl
                              bg-slate-50 dark:bg-slate-800/80
                              border border-slate-200 dark:border-slate-700
                              text-slate-900 dark:text-slate-100
                              focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                              disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {ISSUE_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label
                          htmlFor="beta-description"
                          className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                        >
                          Describe what happened
                        </label>
                        <textarea
                          ref={textareaRef}
                          id="beta-description"
                          value={description}
                          onChange={(e) => setDesc(e.target.value)}
                          disabled={isSubmitting}
                          rows={4}
                          maxLength={2000}
                          placeholder="e.g. When I clicked Save on a prescription, the page went blank…"
                          className="w-full px-3 py-2.5 text-sm rounded-xl resize-none
                            bg-slate-50 dark:bg-slate-800/80
                            border border-slate-200 dark:border-slate-700
                            text-slate-900 dark:text-slate-100
                            placeholder:text-slate-400 dark:placeholder:text-slate-600
                            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                            disabled:opacity-50 transition-colors leading-relaxed"
                        />
                        {/* Character counter + validation hint */}
                        <div className="flex items-center justify-between mt-1 px-0.5">
                          <p className={`text-[10px] transition-colors ${
                            charCount > 0 && charCount < MIN_DESC_LENGTH
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-slate-400 dark:text-slate-600"
                          }`}>
                            {charCount < MIN_DESC_LENGTH
                              ? `${MIN_DESC_LENGTH - charCount} more char${MIN_DESC_LENGTH - charCount !== 1 ? "s" : ""} needed`
                              : ""}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600">
                            {charCount}/2000
                          </p>
                        </div>
                      </div>

                      {/* Error message */}
                      {status === "error" && errorMsg && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 rounded-xl px-3 py-2 leading-snug">
                          ⚠️ {errorMsg}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* ── Footer ───────────────────────────────────────────────── */}
                {status !== "success" && (
                  <div className="flex items-center justify-between px-5 pb-4 pt-1 gap-3">
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-snug">
                      Your report helps improve patient care 🏥
                    </p>
                    <button
                      type="submit"
                      disabled={!isValid || isSubmitting}
                      className={`
                        flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold
                        transition-all duration-150 flex-shrink-0
                        ${isValid && !isSubmitting
                          ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                        }
                      `}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          Send
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
