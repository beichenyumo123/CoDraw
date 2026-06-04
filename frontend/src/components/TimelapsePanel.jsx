import { useState, useRef, useEffect } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';
import {
  enterTimelapse, exitTimelapse,
  getReplayProgress, setReplayIndex,
  setReplayPlaying, setReplaySpeed,
} from '../hooks/useCanvas';

const SPEEDS = [2, 5, 10, 20];

export default function TimelapsePanel() {
  const { timelapseActive, setTimelapseActive, updateAlert } = useAppContext();
  const { playChirp, playPop } = useSound();
  const [progress, setProgress] = useState({ current: 0, total: 0, playing: true, speed: 30 });
  const [speedIdx, setSpeedIdx] = useState(1); // 默认 5x
  const rafRef = useRef(null);
  const sliderRef = useRef(null);
  const dragging = useRef(false);

  // 定时刷新进度
  useEffect(() => {
    if (!timelapseActive) return;
    function tick() {
      if (!dragging.current) {
        const p = getReplayProgress();
        setProgress(p);
        // 自动退出：播放完毕
        if (p.total > 0 && p.current >= p.total && p.playing) {
          setReplayPlaying(false);
          setProgress((prev) => ({ ...prev, playing: false }));
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timelapseActive, getReplayProgress, setReplayPlaying]);

  function handleStart() {
    playChirp();
    enterTimelapse();
    setTimelapseActive(true);
    setProgress(getReplayProgress());
    updateAlert('🎬 时间胶囊：回放协作画作的诞生过程');
  }

  function handleExit() {
    playChirp();
    exitTimelapse();
    setTimelapseActive(false);
    updateAlert('🌳 已退出时间胶囊，回到实时画布');
  }

  function handleTogglePlay() {
    playPop();
    const next = !progress.playing;
    setReplayPlaying(next);
    setProgress((prev) => ({ ...prev, playing: next }));
  }

  function handleSliderChange(e) {
    const val = parseInt(e.target.value);
    setReplayIndex(val);
    setProgress((prev) => ({ ...prev, current: val }));
  }

  function handleSliderDown() {
    dragging.current = true;
    setReplayPlaying(false);
  }

  function handleSliderUp() {
    dragging.current = false;
    setReplayPlaying(true);
    setProgress((prev) => ({ ...prev, playing: true }));
  }

  function handleSpeedChange() {
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    const spd = SPEEDS[nextIdx];
    setReplaySpeed(spd);
    setProgress((prev) => ({ ...prev, speed: spd }));
    playPop();
  }

  if (!timelapseActive) {
    return (
      <div className="mt-2 flex-shrink-0">
        <div className="border-t-2 border-dashed border-[#4A3728]/20 pt-2">
          <h4 className="text-[10px] font-black text-[#7d5b3f] mb-1.5">🎬 时间胶囊</h4>
          <p className="text-[9px] text-[#7d5b3f]/70 mb-2">回放协作画作的诞生过程</p>
          <Button type="primary" size="small" block onClick={handleStart}
            onMouseDown={(e) => e.preventDefault()}>
            ▶️ 开始回放
          </Button>
        </div>
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round(progress.current / progress.total * 100) : 0;

  return (
    <div className="mt-2 flex-shrink-0">
      <div className="border-t-2 border-dashed border-[#4A3728]/20 pt-2">
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-[10px] font-black text-[#7d5b3f]">🎬 时间胶囊</h4>
          <span className="text-[9px] text-[#7d5b3f]/70">{pct}%</span>
        </div>

        {/* 进度条 */}
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={Math.max(progress.total - 1, 0)}
          value={progress.current}
          onChange={handleSliderChange}
          onMouseDown={handleSliderDown}
          onMouseUp={handleSliderUp}
          onTouchStart={handleSliderDown}
          onTouchEnd={handleSliderUp}
          className="w-full accent-[#7BC7A5] h-2 bg-[#E3DEC3] rounded-lg cursor-pointer mb-2"
        />

        {/* 控制栏 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlay}
            onMouseDown={(e) => e.preventDefault()}
            className="w-8 h-8 rounded-lg bg-white border-2 border-[#4A3728] flex items-center justify-center text-sm active:scale-95 transition-all"
          >
            {progress.playing ? '⏸' : '▶️'}
          </button>

          <div className="flex-1 text-[9px] font-black text-[#7d5b3f]">
            {progress.current} / {progress.total} 条
          </div>

          <button
            onClick={handleSpeedChange}
            onMouseDown={(e) => e.preventDefault()}
            className="px-2 h-8 rounded-lg bg-[#F8D147] border-2 border-[#4A3728] text-[10px] font-black active:scale-95 transition-all"
          >
            {progress.speed}x
          </button>

          <Button type="default" size="small" onClick={handleExit}
            onMouseDown={(e) => e.preventDefault()}>
            🚪 退出
          </Button>
        </div>
      </div>
    </div>
  );
}
