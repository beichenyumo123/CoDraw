import { useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function useSound() {
  const ctxRef = useRef(null);
  const { isMuted } = useAppContext();
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;

  const init = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  const playPop = useCallback(() => {
    if (mutedRef.current) return;
    init();
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, [init]);

  const playChirp = useCallback(() => {
    if (mutedRef.current) return;
    init();
    const ctx = ctxRef.current;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + i * 150, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }, [init]);

  const playSplat = useCallback(() => {
    if (mutedRef.current) return;
    init();
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }, [init]);

  useEffect(() => {
    // Resume AudioContext on first user interaction
    const resume = () => {
      if (ctxRef.current && ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
    };
    window.addEventListener('click', resume, { once: true });
    return () => window.removeEventListener('click', resume);
  }, []);

  return { playPop, playChirp, playSplat };
}
