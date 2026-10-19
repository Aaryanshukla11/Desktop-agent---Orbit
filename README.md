<div align="center">

<img src="./apps/ui-tars/resources/icon.png" width="128" height="128" alt="Orbit Beta Logo" />

# 🪐 ORBIT BETA
### *Sovereign Autonomous Desktop GUI & Specialist AI Agent*

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg?style=for-the-badge&logo=windows)](https://github.com/Aaryanshukla11)
[![Privacy First](https://img.shields.io/badge/Telemetry-0%25%20(Completely%20Disabled)-success.svg?style=for-the-badge)](https://github.com/Aaryanshukla11)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F.svg?style=for-the-badge&logo=electron)](https://www.electronjs.org/)

**Developed & Maintained by [Aaryan Shukla](https://github.com/Aaryanshukla11)**

<br/>

<p align="center">
  <b>Orbit Beta</b> is a next-generation sovereign desktop agent that controls your computer, automates real-world software, and executes complex data workflows using a groundbreaking <b>Hybrid Architecture</b>: blending Multimodal Vision-Language Models (VLM) with instant, deterministic native COM/SafeArray automation.
</p>

[Key Features](#-key-features) •
[Architecture](#-hybrid-architecture) •
[Excel Specialist](#-deterministic-excel-engine) •
[Getting Started](#-getting-started) •
[Supported Models](#-supported-models) •
[Privacy Philosophy](#-sovereignty--privacy)

</div>

---

## 🌟 Key Features

### 🖥️ Autonomous Desktop & Browser Operator
- **Computer Vision Grounding:** Inspects screen state visually and executes human-like clicks, keystrokes, scroll actions, and drag operations across arbitrary desktop applications and web browsers.
- **Micro-Paced Native Input:** Driven by high-performance Win32/C# input injectors (`FastInputServer`) for pixel-accurate cursor positioning and zero misclick drift.

### ⚡ Deterministic SafeArray Excel Specialist
- **Whole-Table 2D Matrix Injection:** Generates complex, multi-subject, formula-driven tables and injects all columns and rows simultaneously into active Microsoft Excel workbooks via native COM in milliseconds.
- **Zero-Overlap Geometry Engine:** Automatically senses existing cell boundaries, dynamically determines free column coordinates, and shifts existing charts to the right so your visual dashboards never get obscured.
- **Extreme Token Efficiency:** Accomplishes in a single LLM planning step what traditional agents waste 40+ iterative VLM screenshots and thousands of tokens attempting.

### 🌐 Cross-Device LAN Bridge & Web Control
- **Phone & Tablet Remote Control:** Built-in lightweight HTTP bridge server allows you to monitor, trigger, and inspect tasks from any smartphone, iPad, or secondary laptop on your local Wi-Fi.

### 💎 Adaptive Frosted Glassmorphism UI
- **Windows 11 Native Integration:** Tailored translucent acrylic glass aesthetics (`backdrop-filter: blur`), dark/light theme responsiveness, and native high-contrast window control ergonomics.

---

## 🏛️ Hybrid Architecture

Orbit Beta moves beyond fragile "screenshot-click-repeat" loops by adopting a **bimodal cognitive architecture**:

```
                              ┌──────────────────────────────────┐
                              │     User Natural Language Prompt  │
                              └─────────────────┬────────────────┘
                                                │
                                       [ Task Intent Router ]
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
     ┌───────────────────────────────┐                     ┌───────────────────────────────┐
     │   Deterministic COM Engine    │                     │    Multimodal Vision Operator │
     │  (Excel / Structured Data)    │                     │  (Browser / Desktop Apps/ GUI)│
     ├───────────────────────────────┤                     ├───────────────────────────────┤
     │ • One-Shot Schema Planner     │                     │ • Screenshot Capture          │
     │ • SafeArray 2D Matrix COM     │                     │ • Visual Coordinate Grounding │
     │ • Chart Collision Detection   │                     │ • Win32 Input Synthesis       │
     │ • Zero Latency / 0% Drift     │                     │ • Human-in-the-Loop Feedback  │
     └───────────────┬───────────────┘                     └───────────────┬───────────────┘
                     │                                                     │
                     └──────────────────────────┬──────────────────────────┘
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Live Desktop Execution & Proof │
                               └─────────────────────────────────┘
```

### Traditional Agent vs. Orbit Beta

| Capability | Traditional GUI Agent (Screenshot Loops) | Orbit Beta Hybrid Engine |
| :--- | :--- | :--- |
| **Execution Speed** | 30–60 seconds per column | **< 800 milliseconds** whole table |
| **Cell Accuracy** | High risk of cursor slip / misalignment | **100% Deterministic SafeArray** |
| **Token Usage** | 5,000–15,000 tokens (repeating images) | **Minimal tokens** (single prompt plan) |
| **Chart Safety** | Frequently overwrites existing charts | **Zero-Overlap Auto-Displacement** |
| **Network Autonomy**| Requires cloud relay / external servers | **100% Local Sovereignty** |

---

## 📊 Deterministic Excel Engine

Orbit Beta features an intelligent Excel specialist subsystem designed specifically for business analysts, students, and engineers:

1. **Instant Session Hooking:** Detects any running Microsoft Excel session in real-time or opens an existing workbook seamlessly.
2. **AI Schema Planner (`AiExcelPlanner`):** Understands natural instructions (e.g., *"Add 5 student subjects with marks, total, percentage, and grade"*), designs consistent headers, and computes realistic synthetic or real-world values.
3. **SafeArray Memory Block Injection:** Transforms tabular rows into a 2D memory array (`$arr[$row, $col]`) and writes it in a single atomic COM operation:
   ```powershell
   $range = $sheet.Range($sheet.Cells.Item(1, $startCol), $sheet.Cells.Item($lastRow, $endCol))
   $range.Value2 = $safeArray
   ```
4. **Auto-Formatting & Borders:** Automatically applies matching typography (`Segoe UI`), header fills, grid borders, and dynamic column auto-fitting (`AutoFit()`).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **pnpm**: v9.0.0+ (`npm install -g pnpm`)
- **Operating System**: Windows 10/11 or macOS

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aaryanshukla11/Desktop-agent---Orbit.git
   cd "Desktop-agent---Orbit"
   ```

2. **Install project dependencies:**
   ```bash
   pnpm install
   ```

3. **Launch the Development Environment:**
   ```bash
   pnpm run dev:orbit
   ```

4. **Package Production Binary:**
   ```bash
   pnpm --filter UI-TARs-desktop package
   ```

---

## 🤖 Supported Models

Orbit Beta supports all leading frontier vision and language models out of the box:

- **Local Inference (100% Offline):**
  - [Ollama](https://ollama.ai) (`qwen2.5-coder`, `llama3.2-vision`)
  - [vLLM](https://github.com/vllm-project/vllm) / [LM Studio](https://lmstudio.ai/)
- **Anthropic:** Claude 3.5 Sonnet / Claude 3 Opus
- **OpenAI:** GPT-4o, GPT-4o-mini, o1-preview
- **Google DeepMind:** Gemini 2.0 Flash, Gemini 1.5 Pro
- **DeepSeek:** DeepSeek-V3, DeepSeek-R1

Configure your API keys or local base URLs conveniently through the in-app Settings dialog.

---

## 🔒 Sovereignty & Privacy

- **Zero Telemetry:** All remote analytic beacons, telemetry pings, and external event reporting have been completely stripped and neutralized.
- **Local Credentials:** Your API keys and session history are stored locally on your machine using encrypted storage (`electron-store`) and never sent to third-party tracking servers.
- **Local Data Export:** All execution reports, CSV outputs, and logs remain on your local filesystem under your explicit control.

---

## 📄 License

This project is licensed under the **Apache 2.0 License**. See the [LICENSE](LICENSE) file for more information.

---

<div align="center">
  <b>Built with passion by <a href="https://github.com/Aaryanshukla11">Aaryan Shukla</a></b><br/>
  <i>Empowering sovereign, intelligent, and autonomous computing for everyone.</i>
</div>
