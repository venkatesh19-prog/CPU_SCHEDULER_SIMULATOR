/**
 * Intelligent CPU Scheduler Simulator
 * Fully Client-Side Logic
 */

// ==========================================
// STATE MANAGEMENT
// ==========================================
const State = {
    processes: [
        { id: 1, arrival: 0, burst: 6, priority: 2, color: '#ef4444' },
        { id: 2, arrival: 2, burst: 4, priority: 1, color: '#f97316' },
        { id: 3, arrival: 4, burst: 8, priority: 3, color: '#eab308' },
        { id: 4, arrival: 6, burst: 3, priority: 4, color: '#22c55e' }
    ],
    config: {
        algorithm: 'FCFS',
        quantum: 2
    },
    simulation: {
        timeline: [], // { start, end, pid, color }
        logs: [],     // { time, message }
        metrics: {},  // { pid: { completion, turnaround, waiting, response } }
        summary: {},  // { avgWait, avgTat, util, throughput }
        totalTime: 0
    },
    playback: {
        isPlaying: false,
        currentTime: 0,
        timerId: null,
        speed: 1000
    }
};

const Colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

// ==========================================
// DOM ELEMENTS
// ==========================================
const UI = {
    algoSelect: document.getElementById('algorithm-select'),
    quantumContainer: document.getElementById('quantum-container'),
    quantumInput: document.getElementById('time-quantum'),
    inputs: {
        arrival: document.getElementById('input-arrival'),
        burst: document.getElementById('input-burst'),
        priority: document.getElementById('input-priority')
    },
    btnAdd: document.getElementById('btn-add-process'),
    btnReset: document.getElementById('btn-reset-all'),
    processList: document.getElementById('process-list'),
    
    // Playback
    btnPlay: document.getElementById('btn-play'),
    btnStep: document.getElementById('btn-step'),
    btnBack: document.getElementById('btn-back'),
    btnRestart: document.getElementById('btn-restart'),
    speedSelect: document.getElementById('speed-select'),
    timerDisplay: document.getElementById('timer-display'),
    
    // Viz
    ganttSvg: document.getElementById('gantt-svg'),
    ganttWrapper: document.getElementById('gantt-canvas-wrapper'),
    timeCursor: document.getElementById('time-cursor'),
    
    // Output
    metricsTable: document.getElementById('metrics-table-body'),
    logContainer: document.getElementById('decision-log'),
    summary: {
        wait: document.getElementById('metric-avg-wait'),
        tat: document.getElementById('metric-avg-tat'),
        util: document.getElementById('metric-cpu-util'),
        throughput: document.getElementById('metric-throughput')
    },
    btnContrast: document.getElementById('btn-contrast')
};

// ==========================================
// SCHEDULING ALGORITHMS ENGINE
// ==========================================
const Scheduler = {
    solve: () => {
        // Deep copy processes to avoid mutating input state
        let jobs = JSON.parse(JSON.stringify(State.processes));
        jobs.forEach(p => {
            p.remaining = p.burst;
            p.startTime = -1;
            p.finishTime = -1;
        });

        // Initialize
        let currentTime = 0;
        let completed = 0;
        let timeline = [];
        let logs = [];
        let queue = []; // Ready queue
        const totalProcesses = jobs.length;
        
        // Helper: Check arrivals
        const checkArrivals = (time) => {
            const arrived = jobs.filter(p => p.arrival <= time && p.remaining > 0 && !queue.includes(p));
            // Sort by arrival time for consistency
            arrived.sort((a,b) => a.arrival - b.arrival);
            return arrived;
        };

        // Main Loop
        while (completed < totalProcesses) {
            // Add new arrivals to queue
            const newArrivals = checkArrivals(currentTime);
            queue.push(...newArrivals);

            // If queue empty, jump to next arrival
            if (queue.length === 0) {
                const remainingJobs = jobs.filter(p => p.remaining > 0);
                if (remainingJobs.length === 0) break; // Should not happen
                
                // Find nearest arrival
                remainingJobs.sort((a,b) => a.arrival - b.arrival);
                const nextTime = remainingJobs[0].arrival;
                
                timeline.push({ start: currentTime, end: nextTime, pid: null }); // Idle
                logs.push({ time: currentTime, message: `CPU Idle until ${nextTime}` });
                currentTime = nextTime;
                continue;
            }

            // Select Process based on Algorithm
            let selectedJob = null;
            const algo = State.config.algorithm;

            // Sort Queue based on criteria
            if (algo === 'FCFS') {
                queue.sort((a, b) => a.arrival - b.arrival);
            } else if (algo === 'SJF_NP' || algo === 'SJF_P') {
                queue.sort((a, b) => {
                    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                    return a.arrival - b.arrival;
                });
            } else if (algo === 'PRIORITY_NP' || algo === 'PRIORITY_P') {
                queue.sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    return a.arrival - b.arrival;
                });
            } else if (algo === 'RR') {
                // RR uses FIFO structure, no sort needed usually, but we handle queue rotation manually
            }

            selectedJob = queue[0]; // Pick first
            
            // Record Start Time
            if (selectedJob.startTime === -1) {
                selectedJob.startTime = currentTime;
            }

            // Determine Time Slice
            let slice = 0;
            let isPreemptive = ['SJF_P', 'PRIORITY_P', 'RR'].includes(algo);
            
            if (algo === 'RR') {
                slice = Math.min(State.config.quantum, selectedJob.remaining);
            } else if (isPreemptive) {
                slice = 1; // Check every unit
            } else {
                slice = selectedJob.remaining; // Run to completion
            }

            // Execute
            timeline.push({ 
                start: currentTime, 
                end: currentTime + slice, 
                pid: selectedJob.id, 
                color: selectedJob.color 
            });

            // Log Decision
            let candidates = queue.map(p => `P${p.id}`).join(', ');
            logs.push({ 
                time: currentTime, 
                message: `Selected P${selectedJob.id}. Queue: [${candidates}]. rem: ${selectedJob.remaining}` 
            });

            selectedJob.remaining -= slice;
            currentTime += slice;

            // Post-Execution Logic
            if (selectedJob.remaining === 0) {
                selectedJob.finishTime = currentTime;
                completed++;
                queue.shift(); // Remove from queue
                logs.push({ time: currentTime, message: `P${selectedJob.id} Completed.` });
            } else {
                if (algo === 'RR') {
                    // Check for arrivals occurring EXACTLY during the slice
                    // Technically in RR, new arrivals go to back of queue, 
                    // then the current process goes to back of queue.
                    const arrivalsDuringSlice = checkArrivals(currentTime);
                    // We already added arrivals at start of loop, but time moved.
                    // The function checkArrivals filters those NOT in queue.
                    queue.push(...arrivalsDuringSlice);
                    
                    queue.shift(); // Remove current
                    queue.push(selectedJob); // Add back to end
                } else if (isPreemptive) {
                    // Logic handles re-sorting next iteration
                }
            }
        }

        // Merge contiguous timeline blocks
        const mergedTimeline = [];
        if (timeline.length > 0) {
            let curr = timeline[0];
            for (let i = 1; i < timeline.length; i++) {
                if (timeline[i].pid === curr.pid) {
                    curr.end = timeline[i].end;
                } else {
                    mergedTimeline.push(curr);
                    curr = timeline[i];
                }
            }
            mergedTimeline.push(curr);
        }

        // Calculate Metrics
        let totalWait = 0, totalTat = 0;
        let metrics = {};
        
        jobs.forEach(p => {
            const tat = p.finishTime - p.arrival;
            const wait = tat - p.burst;
            const resp = p.startTime - p.arrival;
            
            totalWait += wait;
            totalTat += tat;
            
            metrics[p.id] = {
                completion: p.finishTime,
                turnaround: tat,
                waiting: wait,
                response: resp
            };
        });

        const busyTime = mergedTimeline.reduce((acc, block) => block.pid ? acc + (block.end - block.start) : acc, 0);

        State.simulation = {
            timeline: mergedTimeline,
            logs: logs,
            metrics: metrics,
            totalTime: currentTime,
            summary: {
                avgWait: (totalWait / totalProcesses).toFixed(2),
                avgTat: (totalTat / totalProcesses).toFixed(2),
                util: ((busyTime / currentTime) * 100).toFixed(1),
                throughput: (totalProcesses / currentTime).toFixed(4)
            }
        };

        // Render everything
        Renderer.drawGantt();
        Renderer.updateMetrics();
    }
};

// ==========================================
// RENDERER
// ==========================================
const Renderer = {
    init: () => {
        Renderer.renderProcessList();
        UI.algoSelect.addEventListener('change', (e) => {
            State.config.algorithm = e.target.value;
            if (e.target.value === 'RR') {
                UI.quantumContainer.classList.remove('hidden');
            } else {
                UI.quantumContainer.classList.add('hidden');
            }
            Controller.reset();
        });
        
        UI.quantumInput.addEventListener('change', (e) => {
            State.config.quantum = parseInt(e.target.value);
            Controller.reset();
        });
    },

    renderProcessList: () => {
        UI.processList.innerHTML = '';
        State.processes.forEach((p, idx) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-700/50 p-3 rounded-lg flex justify-between items-center animate-slide-in border border-gray-600';
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                    <div>
                        <div class="text-xs font-bold text-gray-200">P${p.id}</div>
                        <div class="text-[10px] text-gray-400">Arr: ${p.arrival} | Burst: ${p.burst} | Prio: ${p.priority}</div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="Controller.moveProcess(${idx}, -1)" class="text-gray-400 hover:text-white"><i class="fa-solid fa-arrow-up"></i></button>
                    <button onclick="Controller.moveProcess(${idx}, 1)" class="text-gray-400 hover:text-white"><i class="fa-solid fa-arrow-down"></i></button>
                    <button onclick="Controller.deleteProcess(${idx})" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
            UI.processList.appendChild(div);
        });
    },

    drawGantt: () => {
        const svg = UI.ganttSvg;
        const timeline = State.simulation.timeline;
        const totalTime = State.simulation.totalTime || 1;
        
        // Clear
        svg.innerHTML = '';
        
        // Dimensions
        const width = UI.ganttWrapper.clientWidth;
        const height = UI.ganttWrapper.clientHeight;
        const scale = width / totalTime; // px per unit time

        timeline.forEach(block => {
            if (block.pid === null) return; // Skip idle for visual cleanliness or draw gray
            
            const rectWidth = (block.end - block.start) * scale;
            const x = block.start * scale;
            
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", 20);
            rect.setAttribute("width", rectWidth);
            rect.setAttribute("height", height - 40);
            rect.setAttribute("rx", 4);
            rect.setAttribute("fill", block.color);
            rect.setAttribute("class", "gantt-block");
            
            // Tooltip logic
            rect.addEventListener('mouseenter', (e) => Renderer.showTooltip(e, block));
            rect.addEventListener('mouseleave', () => Renderer.hideTooltip());

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x + rectWidth / 2);
            text.setAttribute("y", height / 2 + 5);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "white");
            text.setAttribute("font-size", "12");
            text.setAttribute("font-family", "monospace");
            text.setAttribute("font-weight", "bold");
            text.textContent = `P${block.pid}`;
            
            // Hide text if block too small
            if (rectWidth < 20) text.style.display = 'none';

            g.appendChild(rect);
            g.appendChild(text);
            svg.appendChild(g);
        });
        
        // Draw Axis ticks
        for(let i=0; i<=totalTime; i++) {
            const x = i * scale;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", height - 10);
            line.setAttribute("x2", x);
            line.setAttribute("y2", height);
            line.setAttribute("stroke", "#6b7280");
            line.setAttribute("stroke-width", "1");
            svg.appendChild(line);
        }
    },

    updateMetrics: () => {
        // Summary
        const s = State.simulation.summary;
        UI.summary.wait.innerText = s.avgWait;
        UI.summary.tat.innerText = s.avgTat;
        UI.summary.util.innerText = s.util + '%';
        UI.summary.throughput.innerText = s.throughput;

        // Table
        UI.metricsTable.innerHTML = '';
        Object.keys(State.simulation.metrics).forEach(pid => {
            const m = State.simulation.metrics[pid];
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/30';
            row.innerHTML = `
                <td class="py-2 text-blue-400 font-bold">P${pid}</td>
                <td class="py-2">${m.completion}</td>
                <td class="py-2">${m.turnaround}</td>
                <td class="py-2">${m.waiting}</td>
            `;
            UI.metricsTable.appendChild(row);
        });
    },
    
    updateLogs: (time) => {
        // Filter logs up to current time
        const currentLogs = State.simulation.logs.filter(l => l.time <= time);
        UI.logContainer.innerHTML = currentLogs.map(l => `
            <div class="border-l-2 border-blue-500 pl-2 py-1">
                <span class="text-blue-400 font-bold mr-2">[T=${l.time}]</span>
                <span class="text-gray-300">${l.message}</span>
            </div>
        `).join('');
        UI.logContainer.scrollTop = UI.logContainer.scrollHeight;
    },

    updateCursor: () => {
        const totalTime = State.simulation.totalTime || 1;
        const width = UI.ganttWrapper.clientWidth;
        const pos = (State.playback.currentTime / totalTime) * width;
        
        UI.timeCursor.style.left = `${pos}px`;
        UI.timerDisplay.innerText = State.playback.currentTime;
    },

    // Tooltip Helper
    showTooltip: (e, block) => {
        let tt = document.getElementById('tooltip-div');
        if (!tt) {
            tt = document.createElement('div');
            tt.id = 'tooltip-div';
            tt.className = 'gantt-tooltip';
            document.body.appendChild(tt);
        }
        tt.style.display = 'block';
        tt.innerHTML = `
            <strong>P${block.pid}</strong><br>
            Start: ${block.start} | End: ${block.end}<br>
            Duration: ${block.end - block.start}
        `;
        tt.style.left = e.pageX + 15 + 'px';
        tt.style.top = e.pageY + 15 + 'px';
    },
    hideTooltip: () => {
        const tt = document.getElementById('tooltip-div');
        if (tt) tt.style.display = 'none';
    }
};

// ==========================================
// CONTROLLER
// ==========================================
const Controller = {
    init: () => {
        // Add Process
        UI.btnAdd.addEventListener('click', () => {
            const arr = parseInt(UI.inputs.arrival.value) || 0;
            const burst = parseInt(UI.inputs.burst.value) || 1;
            const prio = parseInt(UI.inputs.priority.value) || 1;
            
            const newId = State.processes.length > 0 ? Math.max(...State.processes.map(p => p.id)) + 1 : 1;
            
            State.processes.push({
                id: newId,
                arrival: arr,
                burst: burst,
                priority: prio,
                color: Colors[newId % Colors.length]
            });
            
            Renderer.renderProcessList();
            Controller.reset();
        });

        // Reset All
        UI.btnReset.addEventListener('click', () => {
            State.processes = [];
            Renderer.renderProcessList();
            Controller.reset();
        });

        // Playback Controls
        UI.btnPlay.addEventListener('click', Controller.togglePlay);
        UI.btnStep.addEventListener('click', () => Controller.step(1));
        UI.btnBack.addEventListener('click', () => Controller.step(-1));
        UI.btnRestart.addEventListener('click', Controller.reset);
        
        UI.speedSelect.addEventListener('change', (e) => {
            State.playback.speed = parseInt(e.target.value);
            if (State.playback.isPlaying) {
                clearInterval(State.playback.timerId);
                Controller.startTimer();
            }
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (e.code === 'Space') { e.preventDefault(); Controller.togglePlay(); }
            if (e.code === 'ArrowRight') Controller.step(1);
            if (e.code === 'ArrowLeft') Controller.step(-1);
        });

        // High Contrast
        UI.btnContrast.addEventListener('click', () => {
            document.body.classList.toggle('high-contrast');
        });

        // Initial Run
        Scheduler.solve();
    },

    moveProcess: (idx, dir) => {
        if (idx + dir < 0 || idx + dir >= State.processes.length) return;
        const temp = State.processes[idx];
        State.processes[idx] = State.processes[idx + dir];
        State.processes[idx + dir] = temp;
        Renderer.renderProcessList();
        Controller.reset();
    },

    deleteProcess: (idx) => {
        State.processes.splice(idx, 1);
        Renderer.renderProcessList();
        Controller.reset();
    },

    togglePlay: () => {
        State.playback.isPlaying = !State.playback.isPlaying;
        const icon = UI.btnPlay.querySelector('i');
        
        if (State.playback.isPlaying) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
            Controller.startTimer();
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
            clearInterval(State.playback.timerId);
        }
    },

    startTimer: () => {
        State.playback.timerId = setInterval(() => {
            if (State.playback.currentTime < State.simulation.totalTime) {
                Controller.step(1);
            } else {
                Controller.togglePlay(); // Stop at end
            }
        }, State.playback.speed);
    },

    step: (dir) => {
        const newTime = State.playback.currentTime + dir;
        if (newTime >= 0 && newTime <= State.simulation.totalTime) {
            State.playback.currentTime = newTime;
            Renderer.updateCursor();
            Renderer.updateLogs(newTime);
        }
    },

    reset: () => {
        // Stop playback
        if (State.playback.isPlaying) Controller.togglePlay();
        State.playback.currentTime = 0;
        
        // Re-calculate logic
        Scheduler.solve();
        
        // Reset Visuals
        Renderer.updateCursor();
        Renderer.updateLogs(0);
    }
};

// ==========================================
// INIT
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    Renderer.init();
    Controller.init();
});