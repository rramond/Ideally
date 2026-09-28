import { store } from '../lib/storage.js';
import { clamp } from '../lib/utils.js';
import { startAudio, stopAudio, chime } from './audio.js';

/* ============================================================
   FOCUS TIMER — scenes, presets, ambience
============================================================ */
const PRESETS = {
  custom:    null,
  pomodoro:  { work: 25 * 60, brk: 5 * 60 },
  pomodoroL: { work: 50 * 60, brk: 10 * 60 },
  desktime:  { work: 52 * 60, brk: 17 * 60 },
  ultradian: { work: 90 * 60, brk: 20 * 60 }
};
const SCENE_GLOW = { jungle: '#9EFFB6', space: '#A8C8FF', blackhole: '#FFC489', ocean: '#FF9E7E' };

const timerView = document.getElementById('view-timer');
const presetSel = document.getElementById('preset-sel');
const sceneSel = document.getElementById('scene-sel');
const soundSel = document.getElementById('sound-sel');
const phaseEl = document.getElementById('timer-phase');
const startBtn = document.getElementById('timer-start');
const resetBtn = document.getElementById('timer-reset');
const tnH = document.getElementById('tn-h'), tnM = document.getElementById('tn-m'), tnS = document.getElementById('tn-s');

const tPrefs = store.get('ideally.timer', { scene: 'jungle', preset: 'custom', sound: 'on', customDur: 3600 });
sceneSel.value = tPrefs.scene; presetSel.value = tPrefs.preset; soundSel.value = tPrefs.sound;

let tCustomDur = tPrefs.customDur || 3600;
let tPhase = 'work';
let tDuration = currentWorkDuration();
let tRemaining = tDuration;
let tRunning = false, tLast = 0;

function currentWorkDuration(){
  const p = PRESETS[presetSel.value];
  return p ? p.work : tCustomDur;
}
function saveTimerPrefs(){
  store.set('ideally.timer', { scene: sceneSel.value, preset: presetSel.value, sound: soundSel.value, customDur: tCustomDur });
}
function applySceneGlow(){
  document.documentElement.style.setProperty('--scene-glow', SCENE_GLOW[sceneSel.value] || '#C084FC');
}
function playAmbience(){
  if (soundSel.value === 'on') startAudio(sceneSel.value);
  else stopAudio();
}
function setDisplay(sec){
  sec = Math.max(0, Math.round(sec));
  tnH.textContent = Math.floor(sec / 3600);
  tnM.textContent = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  tnS.textContent = String(sec % 60).padStart(2, '0');
}
function setPhaseLabel(){
  phaseEl.textContent = !tRunning && tRemaining === tDuration
    ? (PRESETS[presetSel.value] ? 'Focus · breaks included' : 'Focus')
    : (tPhase === 'work' ? 'Focus' : 'Break');
}
function updateStepperState(){
  const custom = presetSel.value === 'custom';
  document.querySelectorAll('.t-step[data-step]').forEach(b => b.disabled = !custom);
}

document.querySelectorAll('.t-step[data-step]').forEach(b => {
  b.addEventListener('click', () => {
    if (tRunning || presetSel.value !== 'custom') return;
    tCustomDur = clamp(tCustomDur + Number(b.dataset.step), 60, 9 * 3600 + 59 * 60);
    tDuration = tCustomDur; tRemaining = tDuration;
    setDisplay(tRemaining); saveTimerPrefs();
  });
});

presetSel.addEventListener('change', () => {
  stopTimer(true);
  tPhase = 'work';
  tDuration = currentWorkDuration();
  tRemaining = tDuration;
  setDisplay(tRemaining); setPhaseLabel(); updateStepperState(); saveTimerPrefs();
});
sceneSel.addEventListener('change', () => { applySceneGlow(); saveTimerPrefs(); });
soundSel.addEventListener('change', () => { saveTimerPrefs(); if (soundSel.value === 'off') stopAudio(); else if (tRunning) playAmbience(); });

startBtn.addEventListener('click', () => { tRunning ? pauseTimer() : startTimer(); });
resetBtn.addEventListener('click', () => stopTimer(true));

function startTimer(){
  tRunning = true;
  tLast = performance.now();
  timerView.classList.add('running');
  startBtn.textContent = 'Pause';
  setPhaseLabel();
  playAmbience();
}
function pauseTimer(){
  tRunning = false;
  timerView.classList.remove('running');
  startBtn.textContent = 'Resume';
  stopAudio();
}
function stopTimer(reset){
  tRunning = false;
  timerView.classList.remove('running');
  startBtn.textContent = 'Start';
  stopAudio();
  if (reset){
    tPhase = 'work';
    tDuration = currentWorkDuration();
    tRemaining = tDuration;
    setDisplay(tRemaining); setPhaseLabel();
  }
}
function phaseComplete(){
  chime();
  const p = PRESETS[presetSel.value];
  if (p){
    tPhase = tPhase === 'work' ? 'brk' : 'work';
    tDuration = tPhase === 'work' ? p.work : p.brk;
    tRemaining = tDuration;
    setPhaseLabel();
  } else {
    stopTimer(false);
    phaseEl.textContent = 'Complete';
    tRemaining = tDuration;
    setDisplay(tRemaining);
  }
}
setInterval(() => {
  if (!tRunning) return;
  const now = performance.now();
  tRemaining -= (now - tLast) / 1000;
  tLast = now;
  if (tRemaining <= 0) phaseComplete();
  setDisplay(tRemaining);
}, 200);

setDisplay(tRemaining); setPhaseLabel(); updateStepperState(); applySceneGlow();
