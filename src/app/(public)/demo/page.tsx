"use client";

import { useState } from "react";
import {
  IconWifi,
  IconBattery3,
  IconChevronLeft,
  IconPhone,
  IconDotsVertical,
  IconStarFilled,
  IconStar,
  IconCircleCheck,
  IconBrandGoogle,
  IconSend,
  IconArrowLeft,
  IconArrowRight,
} from "@tabler/icons-react";

type Stage =
  | "sms"
  | "loading"
  | "q1"
  | "q2"
  | "q3"
  | "submitting"
  | "thankyou"
  | "google";

const GOLD = "#C9A227";
const GOLD_DARK = "#a68217";
const GOLD_LIGHT = "#FBF7EC";
const DARK = "#333333";
const TEXT = "#555555";
const TEXT_LIGHT = "#888888";
const BORDER = "#E2E8F0";
const BG_LIGHT = "#f5f5f5";

const questions = [
  {
    id: "q1",
    stage: "q1" as Stage,
    text: "On a scale of 1–7, how heard, respected, and supported did you feel by your therapist?",
    type: "rating7" as const,
    min: 1,
    max: 7,
    minLabel: "Not at all",
    maxLabel: "Completely",
    required: true,
  },
  {
    id: "q2",
    stage: "q2" as Stage,
    text: "On a scale of 1–7, how satisfied were you with your overall experience at Mending Minds Therapy?",
    type: "rating7" as const,
    min: 1,
    max: 7,
    minLabel: "Not satisfied",
    maxLabel: "Very satisfied",
    required: true,
  },
  {
    id: "q3",
    stage: "q3" as Stage,
    text: "Is there anything we could do to improve your experience or help you feel better supported?",
    type: "freetext" as const,
    min: 0,
    max: 0,
    minLabel: "",
    maxLabel: "",
    required: false,
  },
];

const questionStages: Stage[] = ["q1", "q2", "q3"];

export default function DemoPage() {
  const [stage, setStage] = useState<Stage>("sms");
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [freeText, setFreeText] = useState("");
  const [googleStars, setGoogleStars] = useState(0);
  const [googleHovered, setGoogleHovered] = useState(0);

  const currentQIndex = questionStages.indexOf(stage);
  const currentQ = currentQIndex >= 0 ? questions[currentQIndex] : null;

  const handleLinkTap = () => {
    setStage("loading");
    setTimeout(() => setStage("q1"), 1200);
  };

  const handleRatingSelect = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goNext = () => {
    if (currentQIndex < questionStages.length - 1) {
      setStage(questionStages[currentQIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentQIndex > 0) {
      setStage(questionStages[currentQIndex - 1]);
    }
  };

  const handleSubmit = () => {
    setStage("submitting");
    setTimeout(() => setStage("thankyou"), 1500);
  };

  const canProceed = () => {
    if (!currentQ) return false;
    if (!currentQ.required) return true;
    return answers[currentQ.id] !== undefined;
  };

  const resetDemo = () => {
    setStage("sms");
    setAnswers({});
    setFreeText("");
    setGoogleStars(0);
    setGoogleHovered(0);
  };

  const renderProgressBar = () => (
    <div style={{ display: "flex", gap: "6px", padding: "16px 20px 0" }}>
      {questions.map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "6px",
            borderRadius: "3px",
            background: i <= currentQIndex ? GOLD : BORDER,
            transition: "background 0.3s ease",
          }}
        />
      ))}
    </div>
  );

  const renderRatingButtons = (q: typeof questions[0]) => {
    const range = Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i);
    return (
      <div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {range.map((n) => {
            const selected = answers[q.id] === n;
            return (
              <button
                key={n}
                onClick={() => handleRatingSelect(q.id, n)}
                style={{
                  minWidth: "40px",
                  height: "44px",
                  borderRadius: "8px",
                  border: `1.5px solid ${selected ? GOLD : BORDER}`,
                  background: selected ? GOLD : "white",
                  color: selected ? "white" : TEXT,
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "'Open Sans', sans-serif",
                  boxShadow: selected ? `0 2px 8px rgba(201,162,39,0.3)` : "none",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "8px",
            fontSize: "11px",
            color: TEXT_LIGHT,
            fontFamily: "'Open Sans', sans-serif",
          }}
        >
          <span>{q.minLabel}</span>
          <span>{q.maxLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, #FFFDF7 0%, ${GOLD_LIGHT} 40%, #f0ece4 100%)`,
        zIndex: 9999,
        padding: "20px",
        fontFamily: "'Open Sans', sans-serif",
      }}
    >
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          color: DARK,
          fontSize: "28px",
          fontWeight: 600,
          marginBottom: "4px",
        }}
      >
        Mending Minds Pulse
      </h1>
      <p style={{ color: TEXT_LIGHT, fontSize: "14px", marginBottom: "32px" }}>
        Post-session feedback walkthrough
      </p>

      {/* Android Phone Frame */}
      <div
        style={{
          position: "relative",
          width: "375px",
          height: "760px",
          borderRadius: "48px",
          background: "#1a1a1a",
          boxShadow: "0 25px 60px rgba(51,51,51,0.2), 0 0 0 3px #333",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Camera notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "28px",
            background: "#1a1a1a",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#222",
              border: "1px solid #333",
            }}
          />
        </div>

        {/* Status bar */}
        <div
          style={{
            position: "absolute",
            top: "28px",
            left: 0,
            right: 0,
            height: "24px",
            background: "rgba(0,0,0,0.5)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            color: "rgba(255,255,255,0.6)",
            fontSize: "11px",
          }}
        >
          <span>2:15 PM</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 600 }}>5G</span>
            <IconWifi size={13} />
            <IconBattery3 size={13} />
          </div>
        </div>

        {/* Screen content area */}
        <div
          style={{
            position: "absolute",
            top: "52px",
            left: 0,
            right: 0,
            bottom: "20px",
            background: "#fff",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* === SMS VIEW === */}
          {stage === "sms" && (
            <>
              <div
                style={{
                  background: "#1a1a1a",
                  borderBottom: "1px solid #333",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <IconChevronLeft size={22} color="#8ab4f8" />
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    (435) 263-0254
                  </p>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "11px",
                      margin: 0,
                    }}
                  >
                    SMS
                  </p>
                </div>
                <IconPhone size={20} color="#8ab4f8" />
                <IconDotsVertical size={20} color="rgba(255,255,255,0.4)" />
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "24px 16px",
                  overflowY: "auto",
                  background: "#0a0a0a",
                }}
              >
                <p
                  style={{
                    color: "rgba(255,255,255,0.25)",
                    fontSize: "11px",
                    textAlign: "center",
                    marginBottom: "24px",
                  }}
                >
                  Today 2:12 PM
                </p>

                <div style={{ maxWidth: "85%" }}>
                  <div
                    style={{
                      background: "#303030",
                      borderRadius: "18px 18px 18px 4px",
                      padding: "12px 16px",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    We value your feedback. Please take a moment to share your
                    experience:{" "}
                    <button
                      onClick={handleLinkTap}
                      style={{
                        color: "#8ab4f8",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        cursor: "pointer",
                        wordBreak: "break-all",
                      }}
                    >
                      pls.mn/s/d7f3
                    </button>
                  </div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.25)",
                      fontSize: "10px",
                      marginTop: "4px",
                      marginLeft: "4px",
                    }}
                  >
                    2:12 PM
                  </p>
                </div>
              </div>
            </>
          )}

          {/* === LOADING === */}
          {stage === "loading" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    border: `3px solid ${GOLD_LIGHT}`,
                    borderTopColor: GOLD,
                    borderRadius: "50%",
                    animation: "demo-spin 0.8s linear infinite",
                    margin: "0 auto",
                  }}
                />
                <p
                  style={{
                    color: TEXT_LIGHT,
                    fontSize: "12px",
                    marginTop: "16px",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Loading...
                </p>
              </div>
            </div>
          )}

          {/* === SURVEY QUESTIONS === */}
          {questionStages.includes(stage) && currentQ && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "white",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Survey header */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                  padding: "24px 20px 20px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Post-Session Feedback
                </p>
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Mending Minds
                </h2>
                <p
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "11px",
                    marginTop: "4px",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Cedar City, UT
                </p>
              </div>

              {/* Progress bar */}
              {renderProgressBar()}

              <p
                style={{
                  padding: "8px 20px 0",
                  fontSize: "12px",
                  color: TEXT_LIGHT,
                  fontFamily: "'Open Sans', sans-serif",
                }}
              >
                Question {currentQIndex + 1} of {questions.length}
              </p>

              {/* Question content */}
              <div style={{ flex: 1, padding: "16px 20px" }}>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: DARK,
                    marginBottom: "20px",
                    lineHeight: "1.4",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  {currentQ.text}
                  {currentQ.required ? (
                    <span style={{ color: "#DC2626", marginLeft: "4px" }}>*</span>
                  ) : (
                    <span
                      style={{
                        color: TEXT_LIGHT,
                        fontSize: "13px",
                        fontWeight: 400,
                        marginLeft: "8px",
                      }}
                    >
                      (optional)
                    </span>
                  )}
                </p>

                {currentQ.type === "freetext" ? (
                  <textarea
                    value={freeText}
                    onChange={(e) => {
                      setFreeText(e.target.value);
                      setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                    }}
                    rows={4}
                    placeholder="Share your thoughts..."
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: `1.5px solid ${BORDER}`,
                      background: "white",
                      padding: "12px",
                      fontSize: "14px",
                      color: DARK,
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = GOLD;
                      e.target.style.boxShadow = `0 0 0 3px rgba(201,162,39,0.15)`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = BORDER;
                      e.target.style.boxShadow = "none";
                    }}
                  />
                ) : (
                  renderRatingButtons(currentQ)
                )}
              </div>

              {/* Navigation */}
              <div
                style={{
                  padding: "12px 20px 16px",
                  display: "flex",
                  gap: "10px",
                  borderTop: `1px solid ${BORDER}`,
                }}
              >
                {currentQIndex > 0 && (
                  <button
                    onClick={goBack}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: BG_LIGHT,
                      color: TEXT,
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    <IconArrowLeft size={14} />
                    Back
                  </button>
                )}

                {currentQIndex < questions.length - 1 ? (
                  <button
                    onClick={goNext}
                    disabled={!canProceed()}
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: canProceed() ? GOLD : BORDER,
                      color: canProceed() ? "white" : TEXT_LIGHT,
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: canProceed() ? "pointer" : "default",
                      fontFamily: "'Open Sans', sans-serif",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Next
                    <IconArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: GOLD,
                      color: "white",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    <IconSend size={14} />
                    Submit Feedback
                  </button>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "0 20px 12px", textAlign: "center" }}>
                <div
                  style={{
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${BORDER}, transparent)`,
                    marginBottom: "10px",
                  }}
                />
                <p
                  style={{
                    color: "rgba(136,136,136,0.4)",
                    fontSize: "9px",
                    letterSpacing: "0.05em",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Powered by Pulse &middot; Cedar City Web Design
                </p>
              </div>
            </div>
          )}

          {/* === SUBMITTING === */}
          {stage === "submitting" && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "white",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    border: `3px solid ${GOLD_LIGHT}`,
                    borderTopColor: GOLD,
                    borderRadius: "50%",
                    animation: "demo-spin 0.8s linear infinite",
                    margin: "0 auto",
                  }}
                />
                <p
                  style={{
                    color: TEXT,
                    fontSize: "14px",
                    marginTop: "16px",
                    fontWeight: 500,
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Submitting your feedback...
                </p>
              </div>
            </div>
          )}

          {/* === THANK YOU + OPTIONAL GOOGLE REVIEW === */}
          {stage === "thankyou" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "white",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                  padding: "24px 20px 20px",
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Mending Minds
                </h2>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "28px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* Checkmark */}
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${GOLD_LIGHT}, #f0ece4)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <IconCircleCheck size={32} color="#16A34A" />
                </div>

                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "22px",
                    fontWeight: 600,
                    color: DARK,
                    margin: "0 0 8px",
                  }}
                >
                  Thank You
                </h3>
                <p
                  style={{
                    color: TEXT,
                    fontSize: "14px",
                    lineHeight: "1.6",
                    textAlign: "center",
                    maxWidth: "260px",
                    margin: "0 0 28px",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Your feedback helps us provide better care. We truly appreciate
                  you taking the time.
                </p>

                {/* Divider */}
                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${BORDER}, transparent)`,
                    marginBottom: "24px",
                  }}
                />

                {/* Optional Google Review */}
                <div
                  style={{
                    width: "100%",
                    background: BG_LIGHT,
                    borderRadius: "12px",
                    padding: "20px",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  {/* Optional badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "white",
                      border: `1.5px solid ${BORDER}`,
                      borderRadius: "12px",
                      padding: "2px 12px",
                      fontSize: "10px",
                      fontWeight: 600,
                      color: TEXT_LIGHT,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    Optional
                  </div>

                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: DARK,
                      margin: "8px 0 6px",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    Share your experience publicly?
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: TEXT_LIGHT,
                      margin: "0 0 16px",
                      lineHeight: "1.5",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    A Google review helps others find the support they need.
                  </p>

                  <button
                    onClick={() => setStage("google")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "white",
                      color: DARK,
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "13px",
                      border: `1.5px solid ${BORDER}`,
                      cursor: "pointer",
                      fontFamily: "'Open Sans', sans-serif",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <IconBrandGoogle size={16} color="#4285f4" />
                    Leave a Google Review
                  </button>

                  <p
                    style={{
                      fontSize: "11px",
                      color: TEXT_LIGHT,
                      marginTop: "12px",
                      fontFamily: "'Open Sans', sans-serif",
                    }}
                  >
                    You can close this page at any time.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "0 20px 12px", textAlign: "center" }}>
                <div
                  style={{
                    height: "1px",
                    background: `linear-gradient(90deg, transparent, ${BORDER}, transparent)`,
                    marginBottom: "10px",
                  }}
                />
                <p
                  style={{
                    color: "rgba(136,136,136,0.4)",
                    fontSize: "9px",
                    letterSpacing: "0.05em",
                    fontFamily: "'Open Sans', sans-serif",
                  }}
                >
                  Powered by Pulse &middot; Cedar City Web Design
                </p>
              </div>
            </div>
          )}

          {/* === GOOGLE REVIEW MOCK === */}
          {stage === "google" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Google Maps top bar */}
              <div
                style={{
                  background: "#fff",
                  borderBottom: "1px solid #e0e0e0",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <IconChevronLeft size={22} color="#5f6368" />
                <div
                  style={{
                    flex: 1,
                    background: "#f1f3f4",
                    borderRadius: "24px",
                    padding: "8px 16px",
                    fontSize: "14px",
                    color: "#5f6368",
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  Mending Minds Therapy
                </div>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "#4285f4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  S
                </div>
              </div>

              {/* Review content */}
              <div style={{ flex: 1, padding: "24px 20px" }}>
                {/* Business avatar */}
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "22px",
                    fontWeight: 700,
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  M
                </div>

                <h3
                  style={{
                    textAlign: "center",
                    fontSize: "18px",
                    fontWeight: 500,
                    color: "#202124",
                    margin: "0 0 4px",
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  Mending Minds Therapy
                </h3>
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#70757a",
                    margin: "0 0 4px",
                  }}
                >
                  166 N 100 W, Suite 7
                </p>
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "12px",
                    color: "#70757a",
                    margin: "0 0 20px",
                  }}
                >
                  Cedar City, UT 84721
                </p>

                {/* Star rating */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "8px",
                    marginBottom: "24px",
                  }}
                  onMouseLeave={() => setGoogleHovered(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= (googleHovered || googleStars);
                    return (
                      <button
                        key={star}
                        onClick={() => setGoogleStars(star)}
                        onMouseEnter={() => setGoogleHovered(star)}
                        style={{
                          padding: "4px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          transition: "transform 0.15s",
                          transform: filled ? "scale(1.1)" : "scale(1)",
                        }}
                      >
                        {filled ? (
                          <IconStarFilled size={36} color="#fbbc04" />
                        ) : (
                          <IconStar size={36} color="#dadce0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Review text area */}
                <textarea
                  placeholder="Share details of your own experience at this place"
                  rows={4}
                  style={{
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid #dadce0",
                    background: "#fff",
                    padding: "12px",
                    fontSize: "14px",
                    color: "#202124",
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                />

                {/* Post button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  }}
                >
                  <button
                    style={{
                      background: googleStars > 0 ? "#1a73e8" : "#dadce0",
                      color: googleStars > 0 ? "white" : "#70757a",
                      border: "none",
                      borderRadius: "20px",
                      padding: "8px 24px",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: googleStars > 0 ? "pointer" : "default",
                      fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                  >
                    Post
                  </button>
                </div>
              </div>

              {/* Google branding */}
              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid #e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <IconBrandGoogle size={14} color="#4285f4" />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#70757a",
                    fontFamily:
                      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  Google Maps
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav pill */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "20px",
            background: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "110px",
              height: "4px",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={resetDemo}
        style={{
          marginTop: "24px",
          color: TEXT_LIGHT,
          background: "rgba(255,255,255,0.6)",
          border: `1px solid ${BORDER}`,
          padding: "8px 20px",
          borderRadius: "10px",
          fontSize: "13px",
          cursor: "pointer",
          fontFamily: "'Open Sans', sans-serif",
        }}
      >
        Reset Demo
      </button>

      {/* Spin animation */}
      <style>{`
        @keyframes demo-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
