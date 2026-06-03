import { useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { consumePendingSfx } from './useWebSocket';

export default function useSound() {
  const ctxRef = useRef(null);
  const { isMuted, sendMessage } = useAppContext();
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;
  const lastSfxSend = useRef(0);

  // 音效协同：发送 sfx 广播（200ms 节流）
  function sendSfx(sound) {
    const now = Date.now();
    if (now - lastSfxSend.current > 200 && sendMessage) {
      lastSfxSend.current = now;
      sendMessage({ type: 'sfx', sound });
    }
  }

  const init = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // 浏览器自动挂起策略：每次播放前确保 AudioContext 已恢复
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
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
    sendSfx('pop');
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
    sendSfx('chirp');
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
    sendSfx('splat');
  }, [init]);

  useEffect(() => {
    const resume = () => {
      if (ctxRef.current && ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
    };
    window.addEventListener('click', resume, { once: true });
    return () => window.removeEventListener('click', resume);
  }, []);

  // 音效协同消费者：每秒轮询一次远程 sfx 队列
  useEffect(() => {
    const interval = setInterval(() => {
      const sounds = consumePendingSfx();
      if (sounds.length === 0 || mutedRef.current) return;
      init();
      sounds.forEach((sound) => {
        if (sound === 'pop') playPopLocal();
        else if (sound === 'chirp') playChirpLocal();
        else if (sound === 'splat') playSplatLocal();
      });
    }, 500);
    return () => clearInterval(interval);
  }, [init]);

  // 本地播放（不发网络广播，避免循环）
  function playPopLocal() {
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  }
  function playChirpLocal() {
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
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.04);
    }
  }
  function playSplatLocal() {
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
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.08);
  }

  return { playPop, playChirp, playSplat };
}
