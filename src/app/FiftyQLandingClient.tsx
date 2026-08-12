"use client";

import { ArrowLeft, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { onboardingGuides } from "@/data/onboardingGuides";
import { trackEvent } from "@/lib/analytics";
import {
  isProfileSetupFailure,
  otpFailureCode,
  PhoneAuthError,
  phoneAuthErrorMessage,
  profileRecoveryMessage,
  retryProfileSetup,
  type PhoneAuthFailureCode,
} from "@/lib/phoneAuthFlow";
import { createClient } from "@/lib/supabase/client";

const introVideoCookie = "intro_video_seen_v1";
const introVideoCookieMaxAge = 60 * 60 * 24 * 365;
const phonePrompt = "전화번호를 입력해주세요.";
const otpPrompt = "6자리 인증 번호를 입력해주세요.";
type AuthStep = "phone" | "otp";

type FiftyQLandingClientProps = {
  initialHasSeenIntro: boolean;
  previewPhoneOnly?: boolean;
  trackLandingView?: boolean;
};

function useTypedText(text: string, active: boolean, interval = 58) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!active) {
      setValue("");
      return;
    }

    setValue("");
    let length = 0;
    const timer = window.setInterval(() => {
      length += 1;
      setValue(text.slice(0, length));
      if (length >= text.length) window.clearInterval(timer);
    }, interval);

    return () => window.clearInterval(timer);
  }, [active, interval, text]);

  return value;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhone(value: string) {
  const digits = phoneDigits(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function internationalPhone(value: string) {
  const digits = phoneDigits(value);
  return digits.startsWith("0") ? `+82${digits.slice(1)}` : `+82${digits}`;
}

function authErrorMessage(message: string, step: AuthStep) {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate") || normalized.includes("seconds")) {
    return "잠시 후 다시 시도해주세요.";
  }
  if (normalized.includes("expired")) return "인증 시간이 지났어요. 다시 요청해주세요.";
  if (step === "otp") return "인증 번호가 맞지 않아요. 다시 확인해주세요.";
  return "인증 번호를 보내지 못했어요. 잠시 후 다시 시도해주세요.";
}

export function FiftyQLandingClient({
  initialHasSeenIntro,
  previewPhoneOnly = false,
  trackLandingView = true,
}: FiftyQLandingClientProps) {
  const introVideoRef = useRef<HTMLVideoElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const phoneInputViewTrackedRef = useRef(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isIntroFinished, setIsIntroFinished] = useState(initialHasSeenIntro);
  const [isAuthVisible, setIsAuthVisible] = useState(initialHasSeenIntro);
  const [isAuthContentVisible, setIsAuthContentVisible] = useState(initialHasSeenIntro);
  const [isIntroMuted, setIsIntroMuted] = useState(true);
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [failureCode, setFailureCode] = useState<PhoneAuthFailureCode | null>(null);
  const [isRecoveringProfile, setIsRecoveringProfile] = useState(false);
  const [promptKey, setPromptKey] = useState(0);
  const [guidePage, setGuidePage] = useState<0 | 1 | null>(null);
  const [nextPath, setNextPath] = useState("");
  const prompt = step === "phone" ? phonePrompt : otpPrompt;
  const typedPrompt = useTypedText(prompt, isAuthContentVisible, 55);
  const guideText = guidePage === null ? "" : onboardingGuides[guidePage];
  const typedGuide = useTypedText(guideText, guidePage !== null, 32);
  const isGuideTypingComplete = typedGuide.length === guideText.length;
  const isPhoneValid = /^010\d{8}$/.test(phoneDigits(phone));
  const isOtpValid = /^\d{6}$/.test(otp);
  const canContinue = step === "phone" ? isPhoneValid : isOtpValid;
  const isPromptTypingComplete =
    isAuthContentVisible && typedPrompt.length === prompt.length;

  useEffect(() => {
    if (previewPhoneOnly) {
      setAuthChecked(true);
      return;
    }

    let mounted = true;
    if (trackLandingView) trackEvent("landing_view");
    const timer = window.setTimeout(() => {
      void createClient().auth.getUser().then(async ({ data }) => {
        if (!mounted) return;
        if (data.user) {
          setIsAuthenticated(true);
          if (!data.user.phone) {
            window.location.replace("/meetings?tab=recommend");
            return;
          }
          const response = await fetch("/api/auth/phone/complete", { method: "POST" });
          const body = (await response.json().catch(() => null)) as
            | { nextPath?: string; errorCode?: PhoneAuthFailureCode }
            | null;
          if (!mounted) return;
          if (response.ok && body?.nextPath) {
            window.location.replace(body.nextPath);
            return;
          }
          const code = body?.errorCode ?? "PROFILE_RESPONSE_INVALID";
          if (isProfileSetupFailure(code)) {
            await recoverProfileSetup();
          } else {
            setFailureCode(code);
            setError(phoneAuthErrorMessage(code));
          }
          setAuthChecked(true);
          return;
        }
        setAuthChecked(true);
      });
    }, 500);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [previewPhoneOnly, trackLandingView]);

  useEffect(() => {
    if (
      !isAuthContentVisible ||
      !authChecked ||
      step !== "phone" ||
      guidePage !== null ||
      phoneInputViewTrackedRef.current
    ) {
      return;
    }

    phoneInputViewTrackedRef.current = true;
    trackEvent("phone_input_view", {
      intro_status: initialHasSeenIntro
        ? "completed_previous_visit"
        : "completed_this_visit",
    });
  }, [authChecked, guidePage, initialHasSeenIntro, isAuthContentVisible, step]);

  useEffect(() => {
    if (!isPromptTypingComplete || guidePage !== null) return;
    const timer = window.setTimeout(() => {
      (step === "phone" ? phoneInputRef.current : otpInputRef.current)?.focus();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [guidePage, isPromptTypingComplete, promptKey, step]);

  const finishIntro = () => {
    document.cookie = `${introVideoCookie}=1; Max-Age=${introVideoCookieMaxAge}; Path=/; SameSite=Lax`;
    trackEvent("landing_video_complete", {
      video_asset: "landing-intro-v1",
    });
    setIsIntroFinished(true);
    setIsAuthVisible(true);
    window.setTimeout(() => setIsAuthContentVisible(true), 1450);
  };

  const toggleIntroSound = () => {
    const video = introVideoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsIntroMuted(nextMuted);
    if (video.paused) void video.play();
  };

  const displayPhone = useMemo(() => formatPhone(phone), [phone]);

  const requestOtp = async () => {
    const localPhone = phoneDigits(phone);
    const prepareResponse = await fetch("/api/auth/phone/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: localPhone }),
    });
    if (!prepareResponse.ok) throw new PhoneAuthError("OTP_SEND_FAILED");

    const { error: sendError } = await createClient().auth.signInWithOtp({
      phone: internationalPhone(localPhone),
      options: { shouldCreateUser: true },
    });
    if (sendError) throw new PhoneAuthError(otpFailureCode(sendError.message));

    setError("");
    setFailureCode(null);
    setOtp("");
    setStep("otp");
    setPromptKey((value) => value + 1);
  };

  const completePhoneAuth = async () => {
    const response = await fetch("/api/auth/phone/complete", { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | {
          nextPath?: string;
          loginType?: "new" | "existing";
          errorCode?: PhoneAuthFailureCode;
        }
      | null;
    if (!response.ok || !body?.nextPath) {
      throw new PhoneAuthError(body?.errorCode ?? "PROFILE_RESPONSE_INVALID");
    }

    trackEvent("phone_verification_complete", {
      login_type: body.loginType ?? "unknown",
    });

    if (body.nextPath.startsWith("/onboarding/questions")) {
      setNextPath(body.nextPath);
      setGuidePage(0);
      setError("");
      return;
    }

    window.location.replace(body.nextPath);
  };

  const verifyOtp = async () => {
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: internationalPhone(phone),
      token: otp,
      type: "sms",
    });
    if (verifyError) throw new PhoneAuthError(otpFailureCode(verifyError.message));
    await completePhoneAuth();
  };

  const recoverProfileSetup = async () => {
    setIsRecoveringProfile(true);
    setFailureCode(null);
    setError(profileRecoveryMessage);
    try {
      await retryProfileSetup(completePhoneAuth);
    } catch (recoveryError) {
      const code = recoveryError instanceof PhoneAuthError
        ? recoveryError.code
        : "PROFILE_RESPONSE_INVALID";
      setFailureCode(code);
      setError(phoneAuthErrorMessage(code));
    } finally {
      setIsRecoveringProfile(false);
    }
  };

  const retryProfileSetupManually = async () => {
    if (isSubmitting || isRecoveringProfile) return;
    setIsSubmitting(true);
    setError("");
    setFailureCode(null);
    try {
      await completePhoneAuth();
    } catch (retryError) {
      const code = retryError instanceof PhoneAuthError
        ? retryError.code
        : "PROFILE_RESPONSE_INVALID";
      if (isProfileSetupFailure(code)) {
        await recoverProfileSetup();
      } else {
        setFailureCode(code);
        setError(phoneAuthErrorMessage(code));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (previewPhoneOnly) return;
    if (!canContinue || isSubmitting || isAuthenticated) return;
    setIsSubmitting(true);
    setError("");
    setFailureCode(null);
    try {
      if (step === "phone") await requestOtp();
      else await verifyOtp();
    } catch (submitError) {
      const code = submitError instanceof PhoneAuthError
        ? submitError.code
        : step === "otp"
          ? "OTP_INVALID"
          : "OTP_SEND_FAILED";
      if (isProfileSetupFailure(code)) {
        await recoverProfileSetup();
      } else {
        setFailureCode(code);
        setError(phoneAuthErrorMessage(code));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnToPhone = () => {
    if (isSubmitting || isRecoveringProfile) return;
    setStep("phone");
    setOtp("");
    setError("");
    setFailureCode(null);
    setPromptKey((value) => value + 1);
  };

  const continueGuide = () => {
    if (!isGuideTypingComplete) return;
    if (guidePage === 0) {
      setGuidePage(1);
      return;
    }
    if (guidePage === 1 && nextPath) window.location.replace(nextPath);
  };

  return (
    <main className="flex h-dvh min-h-[640px] justify-center overflow-hidden bg-[#e9e9e5] text-[#121212] md:px-4">
      <section
        aria-label="교집합 전화번호 로그인"
        className={`relative h-full w-full max-w-[430px] overflow-hidden transition-colors duration-[1400ms] md:my-4 md:h-[calc(100dvh-32px)] md:rounded-[32px] md:border md:border-black/[0.06] md:shadow-frame ${
          isAuthVisible ? "bg-[#F5F1E8]" : "bg-black"
        }`}
      >
        {!initialHasSeenIntro && (
          <video
            ref={introVideoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ${
              isIntroFinished ? "opacity-0" : "opacity-100"
            }`}
            onEnded={finishIntro}
          >
            <source src="/videos/landing-intro-v1.mp4" type="video/mp4" />
          </video>
        )}

        {!initialHasSeenIntro && !isIntroFinished && (
          <button
            type="button"
            onClick={toggleIntroSound}
            aria-label={isIntroMuted ? "영상 소리 켜기" : "영상 음소거"}
            className="absolute right-5 top-5 z-10 flex h-11 items-center gap-2 rounded-full border border-white/35 bg-black/35 px-4 text-[13px] font-semibold text-white shadow-sm backdrop-blur-md transition active:scale-[0.98]"
          >
            {isIntroMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            {isIntroMuted ? "소리 켜기" : "음소거"}
          </button>
        )}

        <div
          className={`absolute inset-0 flex items-center px-8 transition-all duration-700 ${
            isAuthContentVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-5 opacity-0"
          }`}
        >
          {guidePage === null ? (
            <form className="mx-auto w-full max-w-[340px]" onSubmit={handleSubmit}>
            <div className="mb-14 min-h-[74px]">
              <p
                key={`${step}-${promptKey}`}
                className="break-keep text-[22px] font-semibold leading-[1.42] tracking-[-0.045em] text-[#171714]"
              >
                {typedPrompt}
                {typedPrompt.length < prompt.length && (
                  <span className="ml-1 inline-block h-[0.9em] w-px animate-pulse bg-black/55 align-[-0.05em]" />
                )}
              </p>
            </div>

            <div
              className={`transition-all duration-500 ${
                isPromptTypingComplete
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-5 opacity-0"
              }`}
            >
              {step === "phone" ? (
                <div>
                  <input
                    ref={phoneInputRef}
                    value={displayPhone}
                    onChange={(event) => setPhone(phoneDigits(event.target.value))}
                    inputMode="tel"
                    autoComplete="tel"
                    aria-label="전화 번호"
                    placeholder="010-0000-0000"
                    className="h-16 w-full border-b border-black/25 bg-transparent px-1 text-[24px] font-medium tracking-[-0.025em] text-black outline-none placeholder:text-black/18 focus:border-black"
                  />
                  <p className="mt-3 break-keep px-1 text-[11px] font-medium leading-[1.55] tracking-[-0.025em] text-black/45">
                    (계속 진행하면 교집합의 모임/경험 초대 안내를 문자(SMS)로
                    받는 것에 동의하게 됩니다. 언제든지 수신거부라고 문자로
                    보내 수신을 취소할 수 있습니다.)
                  </p>
                </div>
              ) : (
                <input
                  ref={otpInputRef}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="6자리 인증 번호"
                  placeholder="000000"
                  className="h-16 w-full border-b border-black/25 bg-transparent px-1 text-[24px] font-semibold tracking-[0.18em] text-black outline-none placeholder:text-black/15 focus:border-black"
                />
              )}
            </div>

            <div className="mt-4 flex min-h-6 items-center justify-between">
              {step === "otp" && !isRecoveringProfile ? (
                <button
                  type="button"
                  onClick={returnToPhone}
                  className="flex items-center gap-1 text-[13px] font-medium text-black/45 transition hover:text-black"
                >
                  <ArrowLeft size={14} /> 번호 다시 입력
                </button>
              ) : (
                <span />
              )}
              {error && (
                <div className="ml-auto flex flex-col items-end gap-2">
                  <p className={`flex items-center gap-2 text-right text-[13px] font-medium ${
                    isRecoveringProfile ? "text-black/55" : "text-red-600"
                  }`}>
                    {isRecoveringProfile && <span className="h-2 w-2 animate-pulse rounded-full bg-black/45" />}
                    {error}
                  </p>
                  {failureCode && isProfileSetupFailure(failureCode) && (
                    <button
                      type="button"
                      onClick={() => void retryProfileSetupManually()}
                      disabled={isSubmitting}
                      className="text-[13px] font-semibold text-black underline underline-offset-4 disabled:text-black/30"
                    >
                      다시 시도
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canContinue || isSubmitting || isRecoveringProfile}
              aria-label={step === "phone" ? "인증 번호 받기" : "인증하고 계속하기"}
              className={`ml-auto mt-10 flex h-12 w-12 items-center justify-center transition-all duration-300 ${
                canContinue && !isSubmitting && !isRecoveringProfile
                  ? "text-black active:translate-x-0.5"
                  : "cursor-not-allowed text-black/20"
              }`}
            >
              <ArrowRight size={28} strokeWidth={1.8} />
            </button>
            </form>
          ) : (
            <div
              key={guidePage}
              className="mx-auto flex w-full max-w-[340px] flex-col"
            >
              <div className={guidePage === 0 ? "min-h-[190px]" : "min-h-[390px]"}>
                <p className="whitespace-pre-line break-keep text-[16px] font-medium leading-[1.9] tracking-[-0.035em] text-[#171714]">
                  {typedGuide}
                  {!isGuideTypingComplete && (
                    <span className="ml-1 inline-block h-[0.9em] w-px animate-pulse bg-black/55 align-[-0.05em]" />
                  )}
                </p>
              </div>

              <div className="mt-10 flex items-center justify-between border-t border-black/15 pt-5">
                <span className="text-[12px] font-semibold tracking-[0.16em] text-black/35">
                  0{guidePage + 1} / 02
                </span>
                <button
                  type="button"
                  onClick={continueGuide}
                  disabled={!isGuideTypingComplete}
                  aria-label={guidePage === 0 ? "다음 안내 보기" : "질문 시작하기"}
                  className={`flex h-12 w-12 items-center justify-center transition-all duration-300 ${
                    isGuideTypingComplete
                      ? "text-black active:translate-x-0.5"
                      : "cursor-not-allowed text-black/20"
                  }`}
                >
                  <ArrowRight size={28} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
