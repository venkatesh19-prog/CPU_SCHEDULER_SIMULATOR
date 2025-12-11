:root {
    --bg-dark: #111827;
    --bg-card: #1f2937;
    --border: #374151;
    --primary: #2563eb;
    --text-main: #e5e7eb;
    --text-muted: #9ca3af;
}

/* High Contrast Mode Variables */
body.high-contrast {
    --bg-dark: #000000;
    --bg-card: #000000;
    --border: #ffffff;
    --primary: #ffff00;
    --text-main: #ffffff;
    --text-muted: #e5e5e5;
}

body.high-contrast {
    background-color: var(--bg-dark);
    color: var(--text-main);
}

body.high-contrast .bg-gray-800,
body.high-contrast .bg-gray-900 {
    background-color: #000000;
    border: 1px solid #ffffff;
}

body.high-contrast .text-gray-400,
body.high-contrast .text-gray-500,
body.high-contrast .text-gray-600 {
    color: #ffffff;
}

body.high-contrast button {
    border: 1px solid #ffffff;
    color: #ffffff;
}
body.high-contrast button:hover {
    background-color: #333;
}
body.high-contrast .text-blue-500, 
body.high-contrast .text-blue-400 {
    color: #ffff00;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
}

/* Control Buttons */
.control-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #1f2937;
    border: 1px solid #374151;
    color: #e5e7eb;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.2s ease;
}
.control-btn:hover:not(:disabled) {
    background-color: #374151;
    transform: translateY(-2px);
}
.control-btn:active:not(:disabled) {
    transform: translateY(0);
}
.control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Gantt Chart */
.gantt-block {
    transition: opacity 0.2s, stroke-width 0.2s;
    cursor: pointer;
}
.gantt-block:hover {
    opacity: 0.9;
    stroke: white;
    stroke-width: 2px;
}

/* Tooltip */
.gantt-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    z-index: 100;
    white-space: nowrap;
    border: 1px solid #4b5563;
    display: none;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

/* Animations */
@keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-slide-in {
    animation: slideIn 0.3s ease-out forwards;
}