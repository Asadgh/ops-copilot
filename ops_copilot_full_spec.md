# Ops Copilot
## Full Product, Technical & Architecture Specification

Version: 1.0  
Status: Master Specification  
Platform: Chrome Extension (Manifest V3)  
Architecture: Local-first, AI-optional  

---

# Executive Summary

Ops Copilot is a terminal-first operational workspace designed for shift-based and interruption-heavy work environments.

The platform combines:

- operational tracking
- AI-assisted summaries
- voice commands
- pomodoro/focus tracking
- browser intelligence
- operational journaling
- productivity analytics
- performance reporting
- shift-aware workflows
- intelligent daily planning

into a local-first Chrome extension optimized for operational work.

---

# Vision

Ops Copilot should become:

> The operational memory layer for modern work.

The system helps users:
- capture operational work instantly
- preserve context
- recover after interruptions
- track investigations
- generate summaries
- optimize focus
- improve operational planning
- produce performance-review-ready reports

---

# Product Philosophy

## Ops Copilot IS

- operational memory
- AI-assisted work tracking
- terminal-first operational workspace
- productivity intelligence system
- shift-aware operational journal
- operational planning assistant

## Ops Copilot IS NOT

- a generic task manager
- a Jira replacement
- a Notion replacement
- a project management suite
- a collaboration platform

---

# Core Product Principles

## 1. Local First

- All data stored locally
- No mandatory backend
- Offline-first philosophy
- User-controlled data ownership

## 2. Frictionless Capture

Users should log operational work in:
- seconds
- one voice command
- one terminal command
- one click

## 3. Interruption-Tolerant

The system must support:
- sudden interruptions
- context switching
- laptop inactivity
- task resumption
- operational recovery

## 4. Shift-Aware

The platform must understand:
- rotating shifts
- overnight shifts
- operational handoffs
- quiet hours
- downtime

## 5. AI Optional

Ops Copilot must remain fully usable without AI enabled.

AI enhances workflows but never blocks functionality.

---

# Target Users

- operations teams
- dispatch operators
- incident responders
- support engineers
- analysts
- NOC/SOC operators
- logistics coordinators
- shift workers
- technical operations staff

---

# Core Features

# 1. Task & Activity Tracking

## User-Facing Fields

| Field | Type |
|---|---|
| MONTH | String |
| WEEK | String |
| PRIORITY | Enum |
| TASK | Text |
| LOCATION | Text |
| TIMELINE/DAY | Timestamp |
| STATUS | Enum |
| % COMPLETION | Number |
| BLOCKERS | Text |
| IMPROVEMENTS | Text |
| NOTES | Text |

## Status Types

- pending
- active
- blocked
- completed
- archived

## Priority Levels

- low
- medium
- high
- critical

---

# 2. Terminal Interface

Keyboard-first operational interface.

## Example Commands

```bash
> new task investigate routing delay
> remind me in 20 mins
> start focus
> blocked waiting on logs
> summarize today
> shutdown
```

## Terminal Features

- autocomplete
- command history
- contextual suggestions
- fuzzy search
- AI interpretation
- keyboard navigation

---

# 3. Voice Commands

Push-to-talk AI operational assistant.

## Voice Pipeline

```text
Microphone
→ OpenAI Speech-to-Text
→ AI Intent Parser
→ Extension Action
```

## Example Commands

```text
"Create high priority task for dispatch investigation"

"Add blocker waiting on QA"

"Start a 45 minute focus session"

"Generate my weekly summary"
```

---

# 4. Pomodoro & Focus System

## Features

- focus sessions
- short breaks
- long breaks
- interruption recovery
- focus analytics
- productivity tracking

## Focus Modes

| Mode | Duration |
|---|---|
| Standard | 25 min |
| Deep Work | 45 min |
| Extended | 60 min |

---

# 5. Browser Context Capture

Users can:
- capture current page
- attach selected text
- generate AI summaries
- attach browser context to tasks

## Captured Data

- URL
- page title
- selected text
- timestamp
- AI-generated summary

## Capture Methods

### Right Click

```text
Add to Ops Copilot
```

### Terminal

```bash
> capture page
```

### Voice

```text
"Track this page"
```

---

# Floating Side Panel Launcher

Ops Copilot should include a compact floating launcher handle that allows users to quickly open the side panel from any browser page.

This launcher acts as a persistent access point for fast operational capture and should be especially useful when users are actively working in other systems.

## Purpose

The floating launcher helps users avoid unnecessary friction by allowing them to:

- open Ops Copilot instantly
- capture the current page
- create a quick task
- start a voice command
- add a quick note
- start or resume a focus session

## Visual Direction

The launcher should appear as a small rounded button attached near the edge of the browser viewport.

It should feel:

- compact
- modern
- unobtrusive
- recognizable
- movable
- easy to hide

## Launcher Wireframe

```text
┌────────────── Browser Page ──────────────┐
│                                           │
│                                           │
│  ┌─────┐                                  │
│  │ OC  │  ⋮⋮                              │
│  └─────┘                                  │
│                                           │
│                                           │
└───────────────────────────────────────────┘
```

## Launcher Interactions

| Action | Behavior |
|---|---|
| Click | Open Ops Copilot side panel |
| Drag | Reposition launcher vertically |
| Right click | Show quick actions |
| Hover | Reveal tooltip / drag handle |
| Long press | Open quick capture menu |

## Quick Actions

The launcher should support:

- Open side panel
- Create task
- Capture current page
- Start voice command
- Start focus session
- Add quick note

## Launcher Settings

Users should be able to configure:

- show/hide launcher
- launcher position
- opacity
- compact mode
- show only during shift
- disable on selected websites

## UX Rule

The launcher should never block important page content. It should be movable, subtle, and easy to hide.

## Implementation Notes

The launcher should be injected by a content script on supported pages and communicate with the background service worker to open the side panel or trigger quick actions.

Suggested extension capabilities involved:

- content scripts
- sidePanel API
- runtime messaging
- storage for launcher preferences

---

# 6. Operational Timeline

Chronological operational memory feed.

## Example

```text
10:31 Started routing investigation
10:42 Captured dashboard
11:00 Reminder triggered
11:12 Added blocker
11:30 Completed focus session
```

---

# 7. Shift Management

## Features

- editable shift schedules
- overnight shift support
- quiet hours
- shift reminders
- shutdown prompts

## Shift Model

```ts
type Shift = {
  id: string

  days: string[]

  startHour: string
  endHour: string

  timezone: string

  quietHoursEnabled: boolean

  autoShutdownPrompt: boolean
}
```

---

# 8. Intelligent Daily Planning System

Ops Copilot should help users generate and optimize daily operational plans.

## Planning Inputs

- active tasks
- task priority
- due times
- estimated effort
- shift duration
- historical completion patterns
- focus patterns
- interruption trends
- recurring workflows

## Planning Philosophy

The planner should remain:
- flexible
- editable
- interruption-tolerant
- adaptive

## Example Planning Logic

Routine maintenance tasks should ideally:
- happen early in the shift
- occur during low interruption periods
- complete before operational load increases

However:
- recommendations must remain flexible
- users can always override plans

## Example Generated Plan

```text
07:00 - 07:30
Routine dashboard maintenance

07:30 - 08:15
Review overnight incidents

08:15 - 09:00
Investigate dispatch escalation
```

## Plan Modes

| Mode | Description |
|---|---|
| Manual | User controls everything |
| Assisted | AI suggests plan |
| Adaptive | AI continuously optimizes |

## Plan Commands

```bash
> generate plan
> optimize today
```

---

# 9. Notifications & Alerts

## Notification Types

- reminders
- overdue tasks
- focus completion
- blocker follow-ups
- shift reminders

## Smart Notifications

```text
Dispatch Investigation
Blocked for 1h 14m

[Resume]
[Snooze]
[Complete]
```

---

# 10. Daily Shutdown Workflow

## Trigger

```bash
> shutdown
```

## Questions

- What got completed?
- What remains blocked?
- What should tomorrow focus on?
- Any unresolved issues?

## Outputs

Generate:
- shift summary
- handoff notes
- carry-over tasks
- operational report

---

# 11. Export & Reporting System

Users can export activities for:
- custom date ranges
- shifts
- weeks
- months

## Supported Export Formats

| Format | Supported |
|---|---|
| CSV | Yes |
| Excel (.xlsx) | Yes |
| Markdown | Yes |
| TXT | Yes |
| PDF | Future |

## Selectable Export Fields

Users can choose:
- month
- week
- priority
- task
- location
- timeline
- status
- completion
- blockers
- improvements
- notes
- focus time
- AI tags
- AI summaries
- source URL

## Export Filters

- date range
- shift
- priority
- status
- tags
- completed tasks
- unresolved tasks

---

# 12. AI Performance Reports

Requires user-provided OpenAI API key.

## Report Types

- performance review reports
- weekly operational summaries
- shift handoff reports
- productivity reviews

## Example Prompt

```text
Generate a performance review report for April.
```

## Example Output

```text
April Performance Summary

Key Contributions:
- Investigated 14 incidents
- Improved dispatch monitoring
- Reduced escalation delays

Operational Strengths:
- Strong follow-up consistency
- Effective operational tracking

Recurring Challenges:
- External dependency delays
- Dashboard latency issues
```

---

# 13. AI Integration

## AI Modes

| Mode | Description |
|---|---|
| OFF | No AI usage |
| ASSIST | AI suggestions only |
| AUTO | AI proactively assists |

## AI Features

- task generation
- operational summaries
- productivity analysis
- blocker analysis
- page understanding
- voice interpretation
- daily planning optimization

## API Key Handling

Users provide their own OpenAI API key.

Stored locally only.

## Security Rules

- API keys never exposed to content scripts
- AI requests routed through background worker
- no automatic uploads
- no forced cloud sync

---

# 14. Technical Architecture

## High-Level Architecture

```text
Chrome Extension
├── UI Layer
├── Background Service Worker
├── Local Database
├── AI Service Layer
├── Voice Layer
├── Notification Layer
└── Browser Context Layer
```

## Technical Stack

### Frontend
- React
- TypeScript
- TailwindCSS
- Zustand

### Database
- IndexedDB
- Dexie.js

### Terminal
- xterm.js

### Charts
- Recharts

### AI
- OpenAI API
- GPT-4.1 Mini
- GPT-4.1

### Voice
- OpenAI Speech-to-Text

---

# 15. Extension Architecture

```text
ops-copilot/
├── background/
├── content-scripts/
├── dashboard/
├── sidepanel/
├── terminal/
├── ai/
├── voice/
├── focus/
├── reports/
├── analytics/
├── notifications/
├── storage/
└── shared/
```

---

# 16. Data Models

## Task Model

```ts
type Task = {
  id: string

  month: string
  week: string

  priority: Priority

  task: string
  location: string

  timeline: number

  status: TaskStatus

  completion: number

  blockers: string
  improvements: string
  notes: string

  metadata: TaskMetadata
}
```

## Task Metadata

```ts
type TaskMetadata = {
  createdAt: number
  updatedAt: number

  sourceUrl?: string
  sourceTitle?: string
  pageSummary?: string

  aiTags?: string[]
  aiSummary?: string

  reminderAt?: number

  linkedTasks?: string[]

  activityLog?: ActivityEvent[]
}
```

## Focus Session Model

```ts
type FocusSession = {
  id: string

  taskId?: string

  startTime: number
  endTime?: number

  durationMinutes: number

  status:
    | 'active'
    | 'paused'
    | 'completed'

  interruptions: number
}
```

---

# 17. UI/UX Design System

## UI Philosophy

The interface should feel:
- sleek
- modern
- fast
- intuitive
- operational
- keyboard-first

## Design Inspiration

Blend:
- Linear
- Raycast
- Warp Terminal
- Arc Browser
- modern observability dashboards

## Theme Support

- dark mode (default)
- light mode
- system adaptive

## Typography

### UI
- Inter
- Geist

### Terminal
- JetBrains Mono
- Fira Code

## Dashboard Sections

- Overview
- Tasks
- Focus
- Timeline
- Reports
- AI Insights
- Settings

## Task Card Example

```text
┌──────────────────────────────┐
│ HIGH | 65% | Active          │
│                              │
│ Investigate routing delays   │
│                              │
│ Location: Dispatch Dashboard │
│ Focus: 2/4 Sessions          │
│ Last Updated: 11:20          │
│                              │
│ Blocker: Waiting on logs     │
│                              │
│ [Start Focus] [Complete]     │
└──────────────────────────────┘
```

---

# 18. Browser Permissions

```json
[
  "storage",
  "alarms",
  "notifications",
  "tabs",
  "activeTab",
  "contextMenus",
  "sidePanel",
  "scripting"
]
```

---

# 19. Offline Strategy

Offline-supported:
- tasks
- reminders
- reports
- focus tracking
- notifications
- exports

AI features gracefully disable offline.

---

# 20. Performance Requirements

| Requirement | Target |
|---|---|
| Startup | < 2s |
| Dashboard Load | < 1s |
| Command Execution | < 300ms |
| Voice Processing | < 5s |

---

# 21. MVP Scope

## Included

- task tracking
- terminal UI
- voice commands
- reminders
- notifications
- browser capture
- pomodoro
- shift management
- exports
- AI summaries
- planning engine
- performance reports

## Excluded

- collaboration
- cloud sync
- mobile apps
- multi-user support

---

# 22. Future Roadmap

## Phase 2

- operational analytics
- recurring blocker analysis
- interruption analysis
- productivity trends

## Phase 3

- AI memory
- predictive planning
- investigation mode
- workspace automation

## Phase 4

- mobile companion
- Google integrations
- local AI models
- cross-device syncing

---

# 23. Product Differentiators

## 1. Terminal-first UX

## 2. Shift-aware workflows

## 3. Operational memory

## 4. Voice-driven capture

## 5. AI-optional architecture

## 6. Interruption-tolerant workflows

## 7. Performance-review-ready reporting

## 8. Intelligent operational planning

---

# Final Product Statement

Ops Copilot is an AI-powered operational workspace that helps operational workers capture, organize, plan, track, summarize, and reflect on work with minimal friction while preserving long-term operational memory, providing quick side-panel access, and generating performance-ready operational intelligence.
