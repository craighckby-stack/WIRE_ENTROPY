# WireEntropy: Binary Protocol Optimizer, Compression Benchmarking & Node Telemetry

[![License: MIT](https://img.shields.io/badge/License-MIT-00FF9C.svg?style=flat-square)](LICENSE)
[![Author: Craig Huckaby](https://img.shields.io/badge/Author-Craig%20Huckaby-blue.svg?style=flat-square)](https://github.com/craighckby-stack)
[![Node: v20+](https://img.shields.io/badge/Node-v20%2B-green.svg?style=flat-square)](https://nodejs.org)
[![Storage: SQLite WAL](https://img.shields.io/badge/Storage-SQLite%20(WAL)-blueviolet.svg?style=flat-square)](https://sqlite.org)
[![TypeScript: 5.8](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square)](https://www.typescriptlang.org)

> **High-fidelity systems telemetry, wire protocol benchmarking, and cryptographic data transformation engine.**  
> Built for low-level protocol engineering, Shannon entropy analysis, edge node telemetry, and automated diagnostic audits.

---

## 🌐 Live Preview & Access

You can test and benchmark the system immediately without installing anything locally:

- **🚀 Live Production Preview:** [https://ais-pre-jscdeicuwqjpq5g34r2lbt-483535245139.asia-southeast1.run.app](https://ais-pre-jscdeicuwqjpq5g34r2lbt-483535245139.asia-southeast1.run.app)
- **🛠 Development Instance:** [https://ais-dev-jscdeicuwqjpq5g34r2lbt-483535245139.asia-southeast1.run.app](https://ais-dev-jscdeicuwqjpq5g34r2lbt-483535245139.asia-southeast1.run.app)

---

## 💡 In Plain English: What Am I Looking At?

If you're wondering **"What does this actually do, what does it prove, and is any of this fake?"**, here is the straightforward breakdown:

### 1. What does it do?
Think of this application as two high-performance tools in one:
- **A live stethoscope for the computer:** It continuously monitors the real-time health (CPU usage, physical RAM, process memory, and active network interfaces) of the host machine.
- **A data compression & protocol testing lab:** You input raw data (text, JSON, IoT telemetry, or hex bytes), and the engine runs it through bitwise transformations, calculates mathematical randomness (Shannon entropy), and tests multiple real compression algorithms to measure exact byte savings and microsecond execution speeds.

### 2. What does it prove?
In network engineering, people often blindly compress or encrypt data without knowing if it actually helps. WireEntropy **proves**:
- **Whether compression actually helps or hurts:** Highly repetitive text compresses by 80%+, but data that is already compressed or encrypted (high entropy) will *expand* in size if compressed again. This tool gives you the exact Shannon entropy score ($H$) so you know if processing the data is worth the CPU cost.
- **Speed vs. Size trade-offs:** It measures the real execution time down to the microsecond for Gzip, Deflate, and Brotli, proving whether saving an extra 15 bytes is worth the additional CPU processing time.

### 3. What CPU does it monitor? Is it simulated?
- **It is 100% REAL — NOT simulated.**
- The numbers you see on the dashboard, charts, and Kernel Inspector are queried directly from the **actual CPU cores and RAM of the host Linux server/container** running the app using Node.js's native `os` kernel module.
- It measures real CPU user/system/idle tick cycles, clock frequencies, physical memory allocations, and resident set size (RSS). When the system does heavy work, the charts show the actual load in real time.

### 4. Why will other people find it useful?
- **Backend & Cloud Engineers:** Benchmark payloads to minimize bandwidth egress bills and find the fastest compression algorithms for high-throughput APIs.
- **IoT & Embedded Developers:** Optimize sensor telemetry sent over expensive cellular, LoRa, or satellite links where every byte drained drains battery power and costs money.
- **Cybersecurity & Network Analysts:** Inspect obfuscated payloads, apply XOR bitstream keys, and spot encrypted communication channels via entropy scanning.
- **DevOps & Sysadmins:** An ultra-lightweight, self-hosted node monitor with local SQLite persistence and automated Gemini AI health audits—with zero third-party agent dependencies.

---

## 🎯 Technical Deep-Dive: Why Does This Exist? (The Problem It Solves)

Standard web frameworks deal with verbose strings and JSON. But in **embedded systems, aerospace, IoT, robotics, high-frequency networking, and cybersecurity**, transmitting unoptimized text wastes precious bandwidth, battery, and CPU cycles.

**WireEntropy** gives engineers a specialized, browser-accessible workbench to **inspect, measure, compress, transform, and validate data at the byte and hardware level**:

### 1. Wire-Format Protocol Engineering & Bandwidth Optimization
When packing data into binary protocols:
- **Shannon Entropy Analysis ($H$):** Measures data randomness (0.0 to 8.0 bits/byte). If entropy is low (<3.0), the payload has high repetition and will compress by 80%+. If entropy is near 8.0, the payload is already dense or encrypted—attempting to compress it will waste CPU cycles without saving bytes.
- **Microsecond Compression Trade-Offs:** Simultaneously runs payloads through Deflate, Gzip, and Brotli with real execution timings, answering: *"Is spending 400µs on Brotli compression worth the extra 12% bandwidth savings over Gzip for this packet?"*

### 2. Obfuscation, Ciphers & Payload Forensics
- **XOR Masking & Stream De-obfuscation:** Network frames, telemetry beacons, and covert channels frequently use single-byte XOR masks to bypass basic security filters. WireEntropy enables instant interactive XOR key application, live bitstream diffing, and entropy recalculation.
- **Cryptographic Fingerprinting:** Generates SHA-256 and MD5 signatures for every ingested vector to guarantee transit immutability.

### 3. Edge Node Governance & Schema Drift Prevention
- **Schema Drift Protection:** As distributed nodes evolve, mismatched packet formats corrupt downstream consumers. The Data Contract Registry enforces strict contracts and provides interactive payload validation before packets touch databases.
- **Zero-SaaS Node Observability:** Monitors real host CPU core ticks, physical RAM, V8 heap allocations, and network interfaces natively without expensive third-party agents (e.g., Datadog or New Relic).
- **Autonomous AI Root-Cause Audits:** Pairs hardware metrics with SQLite journal logs and leverages server-side Google Gemini (`gemini-2.5-flash`) or local deterministic heuristics to generate structured diagnoses of system health and potential bottlenecks.

---

## 🏛 System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT (React 19)                       │
│  - Real-Time Hardware Charts   - Multi-Algorithm Compression Table     │
│  - SSE / Polling Telemetry     - Interactive Data Contract Validator   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / EventStream (SSE)
┌───────────────────────────────────▼────────────────────────────────────┐
│                  EXPRESS FULL-STACK ENGINE (server.ts)                 │
│                                                                        │
│  ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────┐ │
│  │ Native OS Sampler      │  │ Protocol Pipeline     │  │ AI Audit   │ │
│  │ - 1s Interval CPU Ticks│  │ - Shannon Entropy H   │  │ Server-Side│ │
│  │ - os.freemem / totalmem│  │ - Bitwise XOR Stream  │  │ Gemini 2.5 │ │
│  │ - Event-Loop Histogram │  │ - Deflate/Gzip/Brotli │  │ Flash SDK  │ │
│  └───────────┬────────────┘  └───────────┬───────────┘  └──────┬─────┘ │
└──────────────┼───────────────────────────┼─────────────────────┼───────┘
               │                           │                     │
               ▼                           ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  EMBEDDED SQLITE STORAGE (better-sqlite3)              │
│       PRAGMA journal_mode = WAL  (Zero-SaaS Persistent Database)       │
│                                                                        │
│  • telemetry_history    • siphon_events    • system_logs    • schemas  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧭 Live Preview How-To: Interactive Tour

Once you open the [Live Preview](https://ais-pre-jscdeicuwqjpq5g34r2lbt-483535245139.asia-southeast1.run.app), navigate using the left sidebar:

### 1. `SYSTEM OVERVIEW` (Command Center)
- **Live Metrics:** View real-time CPU utilization %, host RAM usage, active V8 heap size, and process uptime.
- **Quick Actions:** Click **"EXEC_TRANSFORM"** to push a real live test vector through the bitwise transformation pipeline.
- **AI Audit:** Click **"RUN_EVAL"** to query Gemini server-side for an instant diagnosis of current node stability.

### 2. `HOST DIAGNOSTICS` (Kernel & Hardware Inspector)
- **Core Tick Breakdown:** Inspect individual CPU cores, clock frequencies, and load distribution.
- **Memory Pools:** Track physical host RAM vs. process resident set size (RSS) and V8 heap allocations.
- **Network Interfaces:** View all active network adapters, IP addresses, netmasks, and MAC addresses.
- **Live Diagnostic Probes:** Trigger real memory allocation probes, Shannon entropy scans, and SHA-256 digest checks.

### 3. `BINARY PIPELINE` (Protocol & Entropy Optimizer)
- **Test Vectors:** Select one of the pre-loaded presets (*Network Frame Packet*, *Structured IoT Telemetry*, or *High-Entropy Hex*), or paste custom text/hex/JSON.
- **Adjust Bitwise Mask:** Change the XOR Stream Key (e.g. `0xAA`, `0xFF`, `0x55`) to observe real-time bitstream transformation.
- **Execute Optimization:** Click **"BENCHMARK PROTOCOL OPTIMIZATION"** to compute:
  - Exact Shannon Information Entropy score and classification.
  - SHA-256 & MD5 cryptographic signatures.
  - Byte compression savings percent, compression ratio, and microsecond execution time.
  - Immediate persistence into SQLite (`siphon_events`).

### 4. `LIVE TELEMETRY` (Time-Series Metrics)
- **Streaming Charts:** Watch live streaming line graphs of CPU load %, memory utilization %, and packet throughput.
- **Transport Switch:** Toggle seamlessly between Server-Sent Events (SSE) and HTTP polling.
- **Export Data:** Click **"CSV"** or **"JSON"** at any time to download the historical telemetry dataset.

### 5. `DATA CONTRACTS` (Schema Registry & Validator)
- **Schema Contracts:** Inspect registered binary schemas (e.g., `sch_wire_pkt_v1`, `sch_stream_buffer_v2`, `sch_node_state_v1`).
- **Interactive Validator:** Select a schema, load a test JSON payload, and click **"VALIDATE PAYLOAD AGAINST CONTRACT"** to test field requirements, type constraints, and enum rules.
- **Register New Schemas:** Click **"+ REGISTER_CONTRACT"** to define custom data contracts stored in SQLite.

### 6. `AUDIT LOGS` (Event Journal & AI Console)
- **Log Journal:** Filter real system events by level (`SYS`, `INF`, `WRN`, `ERR`, `ACT`) or search by keyword.
- **Manual Event Injection:** Inject custom diagnostic events directly into the database.
- **Deep AI Audit:** Click **"EXECUTE_AI_AUDIT"** to have Gemini evaluate recent logs and telemetry anomalies.

---

## 🛠 Tech Stack

- **Backend / Runtime:** Node.js (v20+), Express.js
- **Database:** SQLite with `better-sqlite3` (WAL mode enabled for concurrent high-speed reads/writes)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Motion & Icons:** `motion/react`, `lucide-react`
- **AI Integration:** `@google/genai` (`gemini-2.5-flash` running server-side with zero client key exposure)
- **Low-Level Native Modules:** `os` (CPU ticks/memory), `crypto` (hashing), `zlib` (compression)

---

## 💻 Local Development Setup

If you wish to clone and run the project locally on your machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/craighckby-stack/WIRE_ENTROPY.git
   cd WIRE_ENTROPY
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   ```
   Add your Google Gemini API key if you want live AI audits locally (the app includes an automatic heuristic fallback if no key is present):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:3000
   ```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/telemetry` | Returns real-time host CPU load %, memory utilization, V8 heap metrics, and uptime |
| `GET` | `/api/telemetry/stream` | Server-Sent Events (SSE) live telemetry stream |
| `GET` | `/api/telemetry/history` | Fetches historical time-series points recorded in SQLite |
| `GET` | `/api/system/kernel` | Returns full host OS architecture, kernel release, CPU core breakdown, and network interfaces |
| `POST` | `/api/system/probe` | Executes genuine hardware probes (32MB physical memory alloc, kernel RNG entropy scan, SHA-256 MB/s bench, event-loop lag) |
| `POST` | `/api/siphon/process` | Executes bitwise XOR, calculates Shannon entropy, SHA-256 hash, and multi-algorithm compression benchmarks (Deflate, Gzip, Brotli) |
| `GET` | `/api/events` | Retrieves past binary transformation events from SQLite |
| `GET` | `/api/schemas` | Lists all registered schemas in the Data Contract Registry |
| `POST` | `/api/schemas` | Registers a new data contract schema in SQLite |
| `POST` | `/api/schemas/validate` | Validates a test JSON payload against a registered schema with strict type enforcement |
| `GET` | `/api/logs` | Fetches SQLite system journal entries with optional level filter and search query |
| `POST` | `/api/logs` | Injects a new log event into the system journal |
| `POST` | `/api/audit` | Triggers a server-side AI or deterministic system integrity audit of live hardware and logs |

---

## 🗄 SQLite Database Architecture

All data is permanently persisted in an embedded SQLite database using Write-Ahead Logging (`PRAGMA journal_mode = WAL`):

- **`siphon_events`**: Stores payload byte length, Shannon entropy score, SHA-256 hash, XOR keys, multi-algorithm compression ratios, and microsecond timings.
- **`system_logs`**: Stores structured system journal records (`timestamp`, `level`, `module`, `message`, `details`).
- **`telemetry_history`**: Records periodic snapshots of host CPU %, memory %, heap, RSS, and event loop latency.
- **`schema_registry`**: Stores schema contracts and JSON validation rules.

---

## 👤 Author & License

**Author:** **Craig Huckaby**  
- **GitHub:** [@craighckby-stack](https://github.com/craighckby-stack)  
- **Email:** [Craighckby@gmail.com](mailto:Craighckby@gmail.com)  

### License
This project is open-source and licensed under the **[MIT License](LICENSE)**.  
Copyright © 2026 Craig Huckaby.
