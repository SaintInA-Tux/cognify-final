import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTodayChallenge, submitChallenge } from '../../api';
import type { ChallengeProblemResponse, ChallengeSubmitResponse } from '../../api';
import { useAuth } from '../context/AuthContext';
import { usePhiCursor, PhiCursor } from './usePhiCursor';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function ChallengePage() {
  usePhiCursor();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeProblemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<ChallengeSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timerSec, setTimerSec] = useState(900);
  const [timerRunning, setTimerRunning] = useState(true);
  const startTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadChallenge();
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSec(s => {
        if (s <= 1) {
          setTimerRunning(false);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const loadChallenge = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTodayChallenge();
      setChallenge(data);
      if (data.already_attempted) setTimerRunning(false);
    } catch (e: any) {
      setError(e.message || 'Failed to load today\'s challenge.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected || !challenge || submitting) return;
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
    try {
      const res = await submitChallenge(selected, elapsed);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const initials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', color: 'var(--thi)', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'none' }}>
      <PhiCursor />

      {/* Nav */}
      <nav style={{ height: 50, background: 'rgba(10,10,10,.97)', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--thi)', letterSpacing: '.03em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--thi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--bg)', fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>Φ</div>
          Phi<em style={{ color: 'var(--tmd)', fontStyle: 'italic' }}>Prep</em>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate('/chat')} style={{ background: 'none', border: '1px solid var(--bdr)', color: 'var(--tlo)', fontFamily: "'Jost', sans-serif", fontSize: 12.5, padding: '5px 12px', borderRadius: 20, cursor: 'none', transition: 'all .2s' }}>← Back to chat</button>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--s4)', border: '1px solid var(--bdrhi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
          {profile?.name ? initials(profile.name) : 'G'}
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--bdr) transparent' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 28 }}>⚡</div>
              <div style={{ color: 'var(--tlo)', fontSize: 13 }}>Loading today's challenge…</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ background: 'rgba(208,80,64,.1)', border: '1px solid rgba(208,80,64,.25)', borderRadius: 14, padding: '20px 22px', color: '#d07060', fontSize: 13 }}>{error}</div>
          )}

          {challenge && !loading && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tlo)', marginBottom: 6 }}>Daily Challenge</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: 'var(--thi)', lineHeight: 1.1 }}>
                    {new Date(challenge.challenge_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tdm)', marginTop: 5, fontFamily: "'DM Mono', monospace" }}>
                    {challenge.subject} · {challenge.topic} · {challenge.difficulty}
                  </div>
                </div>
                {/* Streak - hardcoded for prototype */}
                <div style={{ background: 'var(--goldsf)', border: '1px solid rgba(200,160,64,.22)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 2, fontSize: 18 }}>🔥🔥🔥</div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 500, color: 'var(--gold)', lineHeight: 1 }}>1</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tlo)', marginTop: 2 }}>day streak</div>
                  </div>
                </div>
              </div>

              {/* Problem card */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bdrhi)', borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative', animation: 'fadeUp .4s ease both' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent)' }} />

                {/* Card head */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--bdr)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20, background: 'rgba(208,80,64,.14)', color: '#d07060', border: '1px solid rgba(208,80,64,.22)' }}>
                    {challenge.difficulty}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20, background: 'var(--s3)', color: 'var(--tmd)', border: '1px solid var(--bdr)' }}>
                    {challenge.topic}
                  </span>
                  <div style={{ flex: 1 }} />
                  {!result && !challenge.already_attempted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>⏱</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 500, color: timerSec <= 120 ? 'var(--danger)' : 'var(--thi)' }}>
                        {timerSec <= 0 ? 'Time up' : formatTime(timerSec)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '24px 24px 20px' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: 'var(--thi)', lineHeight: 1.65, marginBottom: 20 }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {challenge.problem_text}
                    </ReactMarkdown>
                  </div>

                  {/* Options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                    {challenge.options.map(opt => {
                      const isSelected = selected === opt.key;
                      const isCorrect = result && opt.key === result.correct_answer;
                      const isWrong = result && opt.key === selected && !result.is_correct;
                      return (
                        <div
                          key={opt.key}
                          onClick={() => !result && !challenge.already_attempted && setSelected(opt.key)}
                          style={{
                            background: isCorrect ? 'rgba(74,138,80,.1)' : isWrong ? 'rgba(208,80,64,.1)' : isSelected ? 'rgba(255,255,255,.06)' : 'var(--s2)',
                            border: `1px solid ${isCorrect ? 'rgba(74,138,80,.3)' : isWrong ? 'rgba(208,80,64,.3)' : isSelected ? 'var(--bdr2)' : 'var(--bdr)'}`,
                            borderRadius: 10, padding: '11px 14px',
                            display: 'flex', alignItems: 'center', gap: 10,
                            cursor: result || challenge.already_attempted ? 'default' : 'pointer',
                            transition: 'all .2s',
                            pointerEvents: result || challenge.already_attempted ? 'none' : 'all',
                          }}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: isCorrect ? 'rgba(74,138,80,.5)' : isWrong ? 'rgba(208,80,64,.5)' : isSelected ? 'var(--thi)' : 'var(--s4)', border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: isSelected || isCorrect || isWrong ? (isSelected ? 'var(--bg)' : '#fff') : 'var(--tmd)', flexShrink: 0, fontFamily: "'DM Mono', monospace", transition: 'all .2s' }}>
                            {opt.key}
                          </div>
                          <div style={{ fontSize: 13, color: isSelected || isCorrect ? 'var(--thi)' : 'var(--tmd)' }}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt.text}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  {!result && !challenge.already_attempted && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={handleSubmit}
                        disabled={!selected || submitting || timerSec <= 0}
                        style={{ flex: 1, padding: 11, background: (!selected || submitting || timerSec <= 0) ? 'var(--s4)' : 'var(--thi)', color: (!selected || submitting || timerSec <= 0) ? 'var(--tlo)' : 'var(--bg)', border: 'none', borderRadius: 10, fontFamily: "'Jost', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'none', transition: 'all .2s' }}
                      >
                        {submitting ? 'Submitting…' : 'Submit answer'}
                      </button>
                    </div>
                  )}

                  {challenge.already_attempted && !result && (
                    <div style={{ padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 13, color: 'var(--tmd)', textAlign: 'center' }}>
                      You've already submitted today's challenge. Come back tomorrow! 🔥
                    </div>
                  )}
                </div>
              </div>

              {/* Result */}
              {result && (
                <div style={{ background: result.is_correct ? 'rgba(74,138,80,.05)' : 'rgba(208,80,64,.05)', border: `1px solid ${result.is_correct ? 'rgba(74,138,80,.3)' : 'rgba(208,80,64,.3)'}`, borderRadius: 14, padding: '20px 22px', marginBottom: 16, animation: 'fadeUp .3s ease both' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{result.is_correct ? '🎉' : '🤔'}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--thi)', marginBottom: 6 }}>{result.is_correct ? 'Correct! Well done.' : 'Not quite — but this is how you learn.'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--tmd)', lineHeight: 1.6 }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {result.explanation}
                    </ReactMarkdown>
                  </div>
                  <button onClick={() => navigate('/chat')} style={{ marginTop: 16, padding: '9px 20px', background: 'var(--s3)', border: '1px solid var(--bdrhi)', borderRadius: 10, color: 'var(--tmd)', fontFamily: "'Jost', sans-serif", fontSize: 12.5, cursor: 'none', transition: 'all .2s' }}>
                    Try a problem in Brain Mode →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @media(max-width:600px) { div[style*='grid-template-columns: 1fr 1fr'] { grid-template-columns: 1fr!important; } }
        @media(max-width:480px) { body { cursor: auto!important; } }
      `}</style>
    </div>
  );
}
