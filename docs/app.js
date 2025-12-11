/* app.js - frontend-only CPU Scheduler Simulator
   - Scheduling algorithms (client-side)
   - Renderer (SVG Gantt)
   - Playback controls + keyboard
   - Modal popup with animations
   - Import/export JSON
*/

/* ===========================
   State & Defaults
   =========================== */
const State = {
  processes: [
    { id: 1, arrival: 0, burst: 6, priority: 2, color: '#ef4444' },
    { id: 2, arrival: 2, burst: 4, priority: 1, color: '#f97316' },
    { id: 3, arrival: 4, burst: 8, priority: 3, color: '#eab308' }
  ],
  config: { algorithm: 'FCFS', quantum: 2, contextSwitch: 0 },
  simulation: { timeline: [], logs: [], metrics: {}, totalTime: 0, summary: {} },
  playback: { isPlaying: false, currentTime: 0, timerId: null, speed: 100 }
};

const Colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#d946ef'];

/* ===========================
   DOM references
   =========================== */
const UI = {
  algoSelect: document.getElementById('algorithm-select'),
  quantumContainer: document.getElementById('quantum-container'),
  quantumInput: document.getElementById('time-quantum'),
  inputs: { arrival: document.getElementById('input-arrival'), burst: document.getElementById('input-burst'), priority: document.getElementById('input-priority') },
  btnAdd: document.getElementById('btn-add-process'),
  btnReset: document.getElementById('btn-reset-all'),
  processList: document.getElementById('process-list'),
  btnPlay: document.getElementById('btn-play'), btnStep: document.getElementById('btn-step'), btnBack: document.getElementById('btn-back'), btnRestart: document.getElementById('btn-restart'),
  speedSelect: document.getElementById('speed-select'), timerDisplay: document.getElementById('timer-display'),
  ganttSvg: document.getElementById('gantt-svg'), ganttWrapper: document.getElementById('gantt-canvas-wrapper'), timeCursor: document.getElementById('time-cursor'),
  metricsTable: document.getElementById('metrics-table-body'), logContainer: document.getElementById('decision-log'),
  summary: { wait: document.getElementById('metric-avg-wait'), tat: document.getElementById('metric-avg-tat'), util: document.getElementById('metric-cpu-util'), throughput: document.getElementById('metric-throughput') },
  btnContrast: document.getElementById('btn-contrast'), btnExport: document.getElementById('btn-export'), fileImport: document.getElementById('file-import')
};

/* ===========================
   Scheduler (client-side)
   Supports: FCFS, SJF NP/P, PRIORITY NP/P, RR
   Returns timeline blocks: {start, end, pid, color} and decisions/logs
   =========================== */
function runScheduler(processesInput, config){
  // deep copy
  const procs = processesInput.map(p => ({...p, remaining: p.burst, startTime:-1, finishTime:-1}));
  let currentTime = 0;
  let completed = 0;
  const n = procs.length;
  const timeline = [];
  const logs = [];
  const totalProcesses = n;

  // helper to find arrivals not in queue
  const checkArrivals = (time, queue) => {
    const arr = procs.filter(p => p.arrival <= time && p.remaining > 0 && !queue.includes(p));
    arr.sort((a,b) => a.arrival - b.arrival || a.id - b.id);
    return arr;
  };

  // choose next process based on algorithm
  const selectCandidate = (queue, algo, preemptive) => {
    if (queue.length === 0) return null;
    if (algo === 'FCFS') {
      queue.sort((a,b) => a.arrival - b.arrival || a.id - b.id);
      return queue[0];
    }
    if (algo.startsWith('SJF')) {
      queue.sort((a,b) => (a.remaining - b.remaining) || (a.arrival - b.arrival) || a.id - b.id);
      return queue[0];
    }
    if (algo.startsWith('PRIORITY')) {
      queue.sort((a,b) => (a.priority - b.priority) || (a.arrival - b.arrival) || a.id - b.id);
      return queue[0];
    }
    if (algo === 'RR') {
      return queue[0];
    }
    return queue[0];
  };

  // Round Robin queue management
  const procsByArrival = procs.slice().sort((a,b)=>a.arrival-b.arrival||a.id-b.id);
  let queue = [];
  const visited = new Array(procsByArrival.length).fill(false);
  const checkAndEnqueue = (time) => {
    for (let i=0;i<procsByArrival.length;i++){
      if (!visited[i] && procsByArrival[i].arrival <= time){
        queue.push(procsByArrival[i]);
        visited[i]=true;
      }
    }
  };
  checkAndEnqueue(0);

  // main loop
  while (completed < n){
    if (queue.length === 0){
      // idle until next arrival
      const remaining = procs.filter(p=>p.remaining>0);
      if (remaining.length === 0) break;
      const nextArr = Math.min(...remaining.map(r=>r.arrival));
      if (currentTime < nextArr){
        timeline.push({start: currentTime, end: nextArr, pid: null, color: '#94a3b8'});
        logs.push({time: currentTime, message:`Idle until ${nextArr}`} );
        currentTime = nextArr;
        checkAndEnqueue(currentTime);
        continue;
      }
    }

    // pick candidate
    const algo = config.algorithm;
    const isRR = algo === 'RR';
    const isPreemptive = ['SJF_P','PRIORITY_P'].includes(algo);
    // if not RR, our queue is derived from procs with arrival <= time
    if (!isRR){
      queue = procs.filter(p=>p.arrival <= currentTime && p.remaining>0);
    }
    if (!queue.length){ checkAndEnqueue(currentTime); continue; }

    const candidate = selectCandidate(queue, algo, isPreemptive);
    if (!candidate) break;

    if (candidate.startTime === -1) candidate.startTime = currentTime;

    // determine slice
    let slice = 0;
    if (isRR){
      slice = Math.min(config.quantum, candidate.remaining);
    } else if (isPreemptive){
      slice = 1; // step by 1 time unit for preemptive algorithms
    } else {
      slice = candidate.remaining; // run to completion
    }

    // log decision
    logs.push({time: currentTime, message:`Selected P${candidate.id} (rem ${candidate.remaining})`});

    // execute
    timeline.push({start: currentTime, end: currentTime+slice, pid: candidate.id, color: candidate.color || '#3b82f6'});
    candidate.remaining -= slice;
    currentTime += slice;

    // arrival check during execution
    if (isRR) checkAndEnqueue(currentTime);

    // completion handling
    if (candidate.remaining === 0){
      candidate.finishTime = currentTime;
      completed++;
      // remove from queue for RR
      if (isRR){
        queue = queue.filter(q=>q.id!==candidate.id);
      }
    } else {
      // for RR rotate
      if (isRR){
        queue = queue.filter(q=>q.id!==candidate.id);
        queue.push(candidate);
      }
    }
  }

  // merge contiguous blocks with same pid to simplify display
  const merged = [];
  for (let blk of timeline){
    if (merged.length && merged[merged.length-1].pid === blk.pid && merged[merged.length-1].end === blk.start){
      merged[merged.length-1].end = blk.end;
    } else merged.push({...blk});
  }

  // compute metrics
  const metrics = {};
  let totalWait=0, totalTat=0;
  for (let p of procs){
    const completion = p.finishTime>=0 ? p.finishTime : 0;
    const tat = completion - p.arrival;
    const wait = tat - p.burst;
    const response = p.startTime>=0 ? p.startTime - p.arrival : null;
    metrics[p.id] = { completion, turnaround: tat, waiting: wait, response };
    totalWait += wait; totalTat += tat;
  }
  const totalDuration = merged.length ? merged[merged.length-1].end : 0;
  const idleTime = merged.reduce((acc,b)=> acc + ((b.pid===null)?(b.end-b.start):0), 0);
  const busyTime = totalDuration - idleTime;
  const summary = {
    avgWait: n? (totalWait/n).toFixed(2):0,
    avgTat: n? (totalTat/n).toFixed(2):0,
    util: totalDuration? ((busyTime/totalDuration)*100).toFixed(1):'0.0',
    throughput: totalDuration? (n/totalDuration).toFixed(4):'0.0'
  };

  return { timeline: merged, logs, metrics, totalTime: totalDuration, summary };
}

/* ===========================
   Renderer: Gantt SVG + Metrics + Logs
   =========================== */
const Renderer = {
  renderProcessList: () => {
    UI.processList.innerHTML='';
    State.processes.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'bg-gray-700/30 p-3 rounded flex justify-between items-center border border-gray-600';
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full" style="background:${p.color}"></div>
          <div>
            <div class="text-xs font-bold">P${p.id}</div>
            <div class="text-[10px] text-gray-400">Arr:${p.arrival} | Bur:${p.burst} | Pr:${p.priority}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button data-idx="${idx}" class="move-up text-gray-400 hover:text-white" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
          <button data-idx="${idx}" class="move-down text-gray-400 hover:text-white" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
          <button data-idx="${idx}" class="delete text-red-400 hover:text-red-300" title="Delete"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
      UI.processList.appendChild(div);
    });
    // events
    UI.processList.querySelectorAll('.move-up').forEach(btn => btn.addEventListener('click', e=>{
      const i = Number(btn.dataset.idx); Controller.moveProcess(i, -1);
    }));
    UI.processList.querySelectorAll('.move-down').forEach(btn => btn.addEventListener('click', e=>{
      const i = Number(btn.dataset.idx); Controller.moveProcess(i, 1);
    }));
    UI.processList.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', e=>{
      const i = Number(btn.dataset.idx); Controller.deleteProcess(i);
    }));
  },

  drawGantt: () => {
    const svg = UI.ganttSvg;
    const timeline = State.simulation.timeline;
    const totalTime = State.simulation.totalTime || 1;
    svg.innerHTML = ''; // clear
    const width = Math.max(UI.ganttWrapper.clientWidth, totalTime*60 + 100);
    const height = UI.ganttWrapper.clientHeight;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    const scale = width / Math.max(totalTime, 1);

    timeline.forEach(block => {
      const rectWidth = (block.end - block.start)*scale;
      const x = block.start*scale;
      const y = 16;
      const h = height - 32;
      // draw rect (skip tiny zero-length)
      if (rectWidth <= 0) return;
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', rectWidth); rect.setAttribute('height', h);
      rect.setAttribute('rx', 6);
      rect.setAttribute('fill', block.pid===null? '#111827' : (block.color || '#3b82f6'));
      rect.setAttribute('class','gantt-block');
      // data attributes for modal
      rect.setAttribute('data-popup','true'); rect.setAttribute('data-pid', block.pid===null? 'idle': String(block.pid));
      rect.setAttribute('data-start', block.start); rect.setAttribute('data-end', block.end);
      g.appendChild(rect);

      // label
      if (rectWidth > 36 && block.pid !== null){
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', x + rectWidth/2); text.setAttribute('y', y + h/2 + 5);
        text.setAttribute('text-anchor','middle'); text.setAttribute('fill','white'); text.setAttribute('font-size','12'); text.setAttribute('font-family','monospace');
        text.textContent = `P${block.pid}`;
        g.appendChild(text);
      }

      svg.appendChild(g);
    });

    // ticks
    for (let i=0;i<= (State.simulation.totalTime||0); i++){
      const x = i*scale;
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', x); line.setAttribute('y1', height - 12); line.setAttribute('x2', x); line.setAttribute('y2', height);
      line.setAttribute('stroke','#6b7280'); line.setAttribute('stroke-width','1'); svg.appendChild(line);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x+2); t.setAttribute('y', height - 2); t.setAttribute('fill','#9ca3af'); t.setAttribute('font-size','10');
      t.textContent = i; svg.appendChild(t);
    }

    // Attach hover tooltip and click for popup
    svg.querySelectorAll('rect[data-popup="true"]').forEach(r=>{
      r.addEventListener('mouseenter', e=> showTooltip(e, r));
      r.addEventListener('mouseleave', hideTooltip);
      r.addEventListener('click', e=>{
        const pid = r.getAttribute('data-pid');
        const start = r.getAttribute('data-start'); const end = r.getAttribute('data-end');
        showPopup({ title: pid==='idle' ? 'Idle' : `Process P${pid}`, body: `<strong>Start:</strong> ${start}<br><strong>End:</strong> ${end}<br><strong>Duration:</strong> ${end-start}`, buttons:[{text:'Close', cls:'ghost'}] });
      });
    });
  },

  updateMetrics: () => {
    const s = State.simulation.summary; UI.summary.wait.innerText = s.avgWait; UI.summary.tat.innerText = s.avgTat;
    UI.summary.util.innerText = s.util + '%'; UI.summary.throughput.innerText = s.throughput;
    UI.metricsTable.innerHTML = '';
    Object.keys(State.simulation.metrics).forEach(pid=>{
      const m = State.simulation.metrics[pid];
      const tr = document.createElement('tr'); tr.className='border-b border-gray-700';
      tr.innerHTML = `<td class="py-2 text-blue-400 font-bold">P${pid}</td><td class="py-2">${m.completion}</td><td class="py-2">${m.turnaround}</td><td class="py-2">${m.waiting}</td>`;
      UI.metricsTable.appendChild(tr);
    });
  },

  updateLogs: (time) => {
    const logs = State.simulation.logs.filter(l=>l.time <= time);
    UI.logContainer.innerHTML = logs.map(l=>`<div class="border-l-2 border-blue-500 pl-2 py-1 text-[12px]"><span class="text-blue-400 font-bold mr-2">[T=${l.time}]</span>${l.message}</div>`).join('');
    UI.logContainer.scrollTop = UI.logContainer.scrollHeight;
  },

  updateCursor: () => {
    const totalTime = State.simulation.totalTime || 1;
    const width = UI.ganttWrapper.clientWidth || 800;
    const pos = (State.playback.currentTime / totalTime) * width;
    UI.timeCursor.style.left = `${pos}px`;
    UI.timerDisplay.innerText = String(State.playback.currentTime);
  }
};

/* ===========================
   Popup modal helpers
   =========================== */
(function(){
  const root = document.getElementById('modal-root');
  const panel = document.getElementById('modal-panel');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footer = document.getElementById('modal-footer');
  let lastFocused = null;

  function trapFocus(e){
    const focusable = panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length-1];
    if (e.key === 'Tab'){
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') hidePopup();
  }

  function showPopup({title='Info', body='', buttons=[{text:'OK', cls:'primary'}], autoClose=0} = {}){
    lastFocused = document.activeElement;
    titleEl.textContent = title;
    if (typeof body === 'string') bodyEl.innerHTML = body; else { bodyEl.innerHTML=''; bodyEl.appendChild(body); }
    footer.innerHTML = '';
    buttons.forEach(btn=>{
      const b = document.createElement('button'); b.className = `modal-btn ${btn.cls||''}`.trim(); b.textContent = btn.text||'OK';
      b.addEventListener('click', (ev)=> { if (btn.onClick) btn.onClick(ev, hidePopup); else hidePopup(); });
      footer.appendChild(b);
    });
    root.style.display = 'grid';
    requestAnimationFrame(()=> { root.classList.add('open'); panel.focus(); });
    panel.addEventListener('keydown', trapFocus);
    root.addEventListener('click', (e)=> { if (e.target === root) hidePopup(); });
    if (autoClose && Number(autoClose)>0) setTimeout(hidePopup, Number(autoClose));
    root.setAttribute('aria-hidden','false');
  }

  function hidePopup(){
    root.classList.remove('open');
    panel.removeEventListener('keydown', trapFocus);
    setTimeout(()=> { root.style.display='none'; root.setAttribute('aria-hidden','true'); if (lastFocused) lastFocused.focus(); }, 260);
  }

  window.showPopup = showPopup; window.hidePopup = hidePopup;
})();

/* ===========================
   Controller: UI bindings & playback
   =========================== */
const Controller = {
  init: () => {
    Renderer.renderProcessList();
    Controller.bindUI();
    Controller.reset(); // initial simulation
  },

  bindUI: () => {
    UI.btnAdd.addEventListener('click', () => {
      const arr = parseInt(UI.inputs.arrival.value) || 0; const burst = parseInt(UI.inputs.burst.value) || 1; const prio = parseInt(UI.inputs.priority.value) || 1;
      const newId = State.processes.length ? Math.max(...State.processes.map(p=>p.id))+1 : 1;
      State.processes.push({ id: newId, arrival: arr, burst: burst, priority: prio, color: Colors[newId % Colors.length] });
      Renderer.renderProcessList(); Controller.reset();
    });

    UI.btnReset.addEventListener('click', ()=> { State.processes = []; Renderer.renderProcessList(); Controller.reset(); });

    UI.algoSelect.addEventListener('change', (e)=> {
      State.config.algorithm = e.target.value;
      if (State.config.algorithm === 'RR') UI.quantumContainer.classList.remove('hidden'); else UI.quantumContainer.classList.add('hidden');
      Controller.reset();
    });
    UI.quantumInput.addEventListener('change', (e)=> { State.config.quantum = Number(e.target.value); Controller.reset(); });
    document.getElementById('context-switch').addEventListener('change', e=> { State.config.contextSwitch = Number(e.target.value); Controller.reset(); });

    UI.btnPlay.addEventListener('click', Controller.togglePlay);
    UI.btnStep.addEventListener('click', ()=> Controller.step(1));
    UI.btnBack.addEventListener('click', ()=> Controller.step(-1));
    UI.btnRestart.addEventListener('click', Controller.reset);

    UI.speedSelect.addEventListener('change', e=> { State.playback.speed = Number(e.target.value); if (State.playback.isPlaying){ clearInterval(State.playback.timerId); Controller.startTimer(); }});

    // keyboard
    document.addEventListener('keydown', (e)=> {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space'){ e.preventDefault(); Controller.togglePlay(); }
      if (e.code === 'ArrowRight') Controller.step(1);
      if (e.code === 'ArrowLeft') Controller.step(-1);
    });

    // export/import
    UI.btnExport.addEventListener('click', ()=> {
      const data = { processes: State.processes, config: State.config, simulation: State.simulation };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cpu_sim_scenario.json'; a.click();
    });
    UI.fileImport.addEventListener('change', (e)=> {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = ev=> {
        try {
          const d = JSON.parse(ev.target.result);
          if (d.processes) State.processes = d.processes;
          if (d.config) State.config = d.config;
          Renderer.renderProcessList(); Controller.reset();
        } catch(err){ showPopup({title:'Import error', body:'Invalid JSON file', buttons:[{text:'Close', cls:'ghost'}]}); }
      }; r.readAsText(f);
    });

    UI.btnContrast.addEventListener('click', ()=> document.body.classList.toggle('high-contrast'));
  },

  togglePlay: () => {
    State.playback.isPlaying = !State.playback.isPlaying;
    const icon = UI.btnPlay.querySelector('i');
    if (State.playback.isPlaying){
      icon.classList.remove('fa-play'); icon.classList.add('fa-pause');
      Controller.startTimer();
    } else {
      icon.classList.remove('fa-pause'); icon.classList.add('fa-play');
      clearInterval(State.playback.timerId);
    }
  },

  startTimer: () => {
    clearInterval(State.playback.timerId);
    State.playback.timerId = setInterval(()=> {
      if (State.playback.currentTime < State.simulation.totalTime) Controller.step(1);
      else Controller.togglePlay();
    }, State.playback.speed);
  },

  step: (dir) => {
    let newTime = State.playback.currentTime + dir;
    if (newTime < 0) newTime = 0;
    if (newTime > State.simulation.totalTime) newTime = State.simulation.totalTime;
    State.playback.currentTime = newTime;
    Renderer.updateCursor(); Renderer.updateLogs(newTime);
  },

  reset: () => {
    if (State.playback.isPlaying) Controller.togglePlay();
    State.playback.currentTime = 0;
    // ensure colors assigned
    State.processes.forEach((p,i)=> { if (!p.color) p.color = Colors[i % Colors.length]; });
    // run scheduler
    const result = runScheduler(State.processes, State.config);
    State.simulation.timeline = result.timeline;
    State.simulation.logs = result.logs;
    State.simulation.metrics = result.metrics;
    State.simulation.totalTime = result.totalTime;
    State.simulation.summary = result.summary;
    // render
    Renderer.drawGantt(); Renderer.updateMetrics(); Renderer.updateLogs(0); Renderer.updateCursor();
  },

  moveProcess: (idx, dir) => {
    if (idx+dir < 0 || idx+dir >= State.processes.length) return;
    const t = State.processes[idx]; State.processes[idx]=State.processes[idx+dir]; State.processes[idx+dir]=t;
    Renderer.renderProcessList(); Controller.reset();
  },

  deleteProcess: (idx) => {
    State.processes.splice(idx,1); Renderer.renderProcessList(); Controller.reset();
  }
};

/* ===========================
   Tooltip helpers
   =========================== */
let tipDiv = null;
function showTooltip(e, rect){
  if (!tipDiv){ tipDiv = document.createElement('div'); tipDiv.className='gantt-tooltip'; document.body.appendChild(tipDiv); }
  const pid = rect.getAttribute('data-pid'); const s = rect.getAttribute('data-start'); const en = rect.getAttribute('data-end');
  tipDiv.innerHTML = `<strong>${pid==='idle' ? 'Idle' : 'P'+pid}</strong><br>Start: ${s}<br>End: ${en}<br>Dur: ${en-s}`;
  tipDiv.style.left = (e.pageX+12) + 'px'; tipDiv.style.top = (e.pageY+12) + 'px'; tipDiv.style.display='block';
}
function hideTooltip(){ if (tipDiv) tipDiv.style.display='none'; }

/* ===========================
   Init on DOM load
   =========================== */
window.addEventListener('DOMContentLoaded', ()=> {
  Renderer.renderProcessList();
  Controller.init();
});
