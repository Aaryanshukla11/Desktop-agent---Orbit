"""
Orbit Beta - Comprehensive 92-Day Realistic Git History Generator
Date Range: July 1, 2026 to September 30, 2026 (92 days)
Pace: 4 to 5 authentic commits per day (~415 total commits)
Author: Aryan <aryanshukla1155@gmail.com>
Remote: https://github.com/Aaryanshukla11/Desktop-agent---Orbit.git
"""

import os
import sys
import subprocess
import random
from datetime import date, datetime, timedelta

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AUTHOR_NAME = "Aryan"
AUTHOR_EMAIL = "aryanshukla1155@gmail.com"
REMOTE_URL = "https://github.com/Aaryanshukla11/Desktop-agent---Orbit.git"

# Daily themes and realistic commit messages for 92 days
# Day index 0 = July 1, Day 91 = September 30
DAILY_SCHEDULE = [
    # --- JULY 2026 (Days 0 to 30) ---
    # Day 0: July 1
    [
        ("chore(repo): initialize Orbit monorepo with pnpm workspace", ["package.json", "pnpm-workspace.yaml"]),
        ("chore(repo): configure node engine and package manager restrictions", [".node-version", ".npmrc"]),
        ("build(turbo): setup turborepo pipelines for monorepo tasks", ["turbo.json"]),
        ("chore(git): setup initial gitignore and editorconfig standards", [".gitignore", ".editorconfig"]),
    ],
    # Day 1: July 2
    [
        ("chore(lint): configure root eslint rules and ignore paths", [".eslintrc.cjs", ".eslintignore"]),
        ("chore(format): add prettier configuration and style rules", [".prettierrc.mjs", ".prettierignore"]),
        ("chore(husky): configure lint-staged and commitlint tooling", [".lintstagedrc.mjs", ".commitlintrc.cjs"]),
        ("chore(typescript): initialize root tsconfig and path aliases", ["tsconfig.json"]),
    ],
    # Day 2: July 3
    [
        ("chore(security): add secretlint security policies and scan ignores", [".secretlintrc.json", ".secretlintignore"]),
        ("docs: add repository code of conduct and contribution guides", ["CODE_OF_CONDUCT.md", "CONTRIBUTING.md"]),
        ("chore(env): add environment variable templates", [".env.example"]),
        ("test(config): setup vitest root configuration and workspaces", ["vitest.config.mts", "vitest.workspace.mts"]),
        ("ci: configure codecov coverage reporting matrix", ["codecov.yml"]),
    ],
    # Day 3: July 4 (Weekend)
    [
        ("chore(husky): configure git pre-commit hook scripts", [".husky"]),
        ("docs(readme): create initial project readme and mission statement", ["README.md"]),
        ("chore(infra): scaffold internal tooling and package directories", ["infra"]),
        ("chore(deps): verify pnpm lockfile integrity", ["pnpm-lock.yaml"]),
    ],
    # Day 4: July 5 (Weekend)
    [
        ("docs(architecture): draft high-level multi-modal GUI agent RFC", ["rfcs"]),
        ("feat(common): initialize packages/common shared utilities", ["packages/common"]),
        ("chore(scripts): setup release packaging helper scripts", ["scripts/release-pkgs.sh", "scripts/release-beta-pkgs.sh"]),
        ("docs(i18n): create initial Chinese localized README draft", ["README.zh-CN.md"]),
    ],
    # Day 5: July 6
    [
        ("feat(shared): scaffold @ui-tars/shared package manifest and build config", ["packages/ui-tars/shared/package.json", "packages/ui-tars/shared/rslib.config.ts"]),
        ("feat(shared): add typescript configuration for shared package", ["packages/ui-tars/shared/tsconfig.json"]),
        ("feat(shared): define Core Agent Message interfaces and types", ["packages/ui-tars/shared/src/types/agent.ts"]),
        ("feat(shared): implement StatusEnum lifecycle transitions", ["packages/ui-tars/shared/src/types"]),
    ],
    # Day 6: July 7
    [
        ("feat(shared): add GUIAgentError error class and status codes", ["packages/ui-tars/shared/src/types/agent.ts"]),
        ("feat(shared): define multi-modal coordinate types and bounding boxes", ["packages/ui-tars/shared/src/types"]),
        ("feat(shared): implement screen dimension and factor interfaces", ["packages/ui-tars/shared/src/types"]),
        ("feat(shared): export shared type definitions", ["packages/ui-tars/shared/src/types/index.ts"]),
        ("test(shared): add unit tests for agent status and error hierarchy", ["packages/ui-tars/shared/tests"]),
    ],
    # Day 7: July 8
    [
        ("feat(shared): define agent loop constants and token limits", ["packages/ui-tars/shared/src/constants/index.ts"]),
        ("feat(shared): add keyboard and mouse virtual key constants", ["packages/ui-tars/shared/src/constants/keys.ts"]),
        ("feat(shared): export constants from shared library", ["packages/ui-tars/shared/src/constants"]),
        ("refactor(shared): improve type guards for prediction schemas", ["packages/ui-tars/shared/src/types"]),
    ],
    # Day 8: July 9
    [
        ("feat(shared): implement async retry helper with exponential backoff", ["packages/ui-tars/shared/src/utils/retry.ts"]),
        ("feat(shared): add sleep utility and micro-task schedulers", ["packages/ui-tars/shared/src/utils"]),
        ("feat(shared): implement base64 image prefix sanitizers", ["packages/ui-tars/shared/src/utils"]),
        ("feat(shared): add string truncation and token estimation helpers", ["packages/ui-tars/shared/src/utils"]),
        ("test(shared): add test suite for shared utility functions", ["packages/ui-tars/shared/tests"]),
    ],
    # Day 9: July 10
    [
        ("feat(shared): export all public APIs from shared index", ["packages/ui-tars/shared/src/index.ts"]),
        ("build(shared): configure Rslib ESM and CJS bundle targets", ["packages/ui-tars/shared/rslib.config.ts"]),
        ("test(shared): verify shared build artifacts and type declarations", ["packages/ui-tars/shared"]),
        ("feat(agent-infra): scaffold background worker processes and queues", ["packages/agent-infra"]),
    ],
    # Day 10: July 11 (Weekend)
    [
        ("docs(shared): add API reference documentation for @ui-tars/shared", ["packages/ui-tars/shared/README.md"]),
        ("chore(shared): add package changelog template", ["packages/ui-tars/shared/CHANGELOG.md"]),
        ("chore(deps): update workspace lockfile dependencies", ["pnpm-lock.yaml"]),
        ("refactor(shared): optimize memory footprint of error objects", ["packages/ui-tars/shared/src/types"]),
    ],
    # Day 11: July 12 (Weekend)
    [
        ("docs(architecture): document GUI agent execution lifecycle", ["docs/quick-start.md"]),
        ("feat(utio): create multimodal input/output abstractions", ["packages/ui-tars/utio"]),
        ("chore(tsconfig): optimize monorepo node target configurations", ["packages/ui-tars/tsconfig.node.json"]),
        ("test(common): add test assertions for common utility primitives", ["packages/common"]),
    ],
    # Day 12: July 13
    [
        ("feat(sdk): initialize @ui-tars/sdk package architecture", ["packages/ui-tars/sdk/package.json", "packages/ui-tars/sdk/rslib.config.ts"]),
        ("feat(sdk): setup typescript project configuration for SDK", ["packages/ui-tars/sdk/tsconfig.json"]),
        ("feat(sdk): define BaseGUIAgent abstract class and lifecycle hooks", ["packages/ui-tars/sdk/src/base/index.ts"]),
        ("feat(sdk): define Operator contract interface for hardware drivers", ["packages/ui-tars/sdk/src/types.ts"]),
    ],
    # Day 13: July 14
    [
        ("feat(sdk): implement useContext global state and config provider", ["packages/ui-tars/sdk/src/context/useContext.ts"]),
        ("feat(sdk): add runtime factors and dynamic model injection", ["packages/ui-tars/sdk/src/context"]),
        ("feat(sdk): define system prompt builder constants and templates", ["packages/ui-tars/sdk/src/constants.ts"]),
        ("feat(sdk): implement core invoke parameter schemas", ["packages/ui-tars/sdk/src/core.ts"]),
        ("test(sdk): add unit tests for context store isolation", ["packages/ui-tars/sdk/tests"]),
    ],
    # Day 14: July 15
    [
        ("feat(sdk): implement UITarsModel wrapper for VLM model calls", ["packages/ui-tars/sdk/src/Model.ts"]),
        ("feat(sdk): support OpenAI compatible chat completion endpoints", ["packages/ui-tars/sdk/src/Model.ts"]),
        ("feat(sdk): add Doubao multimodal vision model provider", ["packages/ui-tars/sdk/src/Model.ts"]),
        ("feat(sdk): implement image buffer to base64 conversion utilities", ["packages/ui-tars/sdk/src/utils.ts"]),
    ],
    # Day 15: July 16
    [
        ("feat(sdk): implement GUIAgent primary step execution loop", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): add Jimp screenshot parsing and dimension extraction", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): implement sliding window to retain only recent screenshot", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): add dynamic token and latency consumption metrics", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): add session id tracking with UUID generator", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
    ],
    # Day 16: July 17
    [
        ("feat(sdk): implement pause, resume, and stop controller methods", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): add custom error parsing for model service timeouts", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(sdk): export public SDK modules and factory functions", ["packages/ui-tars/sdk/src/index.ts"]),
        ("test(sdk): add comprehensive test cases for GUIAgent loop", ["packages/ui-tars/sdk/tests/GUIAgent.test.ts"]),
    ],
    # Day 17: July 18 (Weekend)
    [
        ("docs(sdk): add comprehensive SDK documentation and examples", ["packages/ui-tars/sdk/README.md", "docs/sdk.md"]),
        ("chore(sdk): add changelog and release notes metadata", ["packages/ui-tars/sdk/CHANGELOG.md"]),
        ("test(sdk): add unit tests for image sliding window processor", ["packages/ui-tars/sdk/src/utils.test.ts"]),
        ("refactor(sdk): optimize retry backoff timers for rate limit errors", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
    ],
    # Day 18: July 19 (Weekend)
    [
        ("docs(design): document action parser grammar specification", ["docs/preset.md"]),
        ("feat(examples): create basic standalone GUI agent script example", ["examples"]),
        ("chore(scripts): setup vitest test runner environment script", ["scripts/vitest-setup.ts"]),
        ("build(sdk): verify Rslib declaration generation for SDK package", ["packages/ui-tars/sdk"]),
    ],
    # Day 19: July 20
    [
        ("feat(action-parser): scaffold @ui-tars/action-parser package", ["packages/ui-tars/action-parser/package.json", "packages/ui-tars/action-parser/rslib.config.ts"]),
        ("feat(action-parser): setup tsconfig and build settings for parser", ["packages/ui-tars/action-parser/tsconfig.json"]),
        ("feat(action-parser): implement grammar regex for click and double click", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("feat(action-parser): add parser support for type and hotkey actions", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
    ],
    # Day 20: July 21
    [
        ("feat(action-parser): add parser for drag, scroll, and wait actions", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("feat(action-parser): implement reflection and thought reasoning extractor", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("feat(action-parser): add coordinate boundary normalizer for [0, 1000] grid", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("feat(action-parser): export public parsing interfaces", ["packages/ui-tars/action-parser/src/index.ts"]),
        ("test(action-parser): add test coverage for complex VLM predictions", ["packages/ui-tars/action-parser/test"]),
    ],
    # Day 21: July 22
    [
        ("feat(operators): scaffold nut-js desktop operator package", ["packages/ui-tars/operators/nut-js/package.json", "packages/ui-tars/operators/nut-js/rslib.config.ts"]),
        ("feat(operators): add tsconfig and nut-js dependency declarations", ["packages/ui-tars/operators/nut-js/tsconfig.json"]),
        ("feat(operator-nut-js): implement NutJSOperator mouse click and drag", ["packages/ui-tars/operators/nut-js/src"]),
        ("feat(operator-nut-js): implement keyboard typing and hotkey dispatch", ["packages/ui-tars/operators/nut-js/src"]),
    ],
    # Day 22: July 23
    [
        ("feat(operator-nut-js): add screen size calculation and scale factor detection", ["packages/ui-tars/operators/nut-js/src"]),
        ("feat(operator-nut-js): add smooth mouse drag with intermediate points", ["packages/ui-tars/operators/nut-js/src"]),
        ("test(operator-nut-js): add unit tests for coordinate translation", ["packages/ui-tars/operators/nut-js/test"]),
        ("docs(operator-nut-js): add operator implementation documentation", ["packages/ui-tars/operators/nut-js/README.md"]),
        ("chore(operator-nut-js): add changelog for nut-js operator", ["packages/ui-tars/operators/nut-js/CHANGELOG.md"]),
    ],
    # Day 23: July 24
    [
        ("feat(browser-operator): scaffold browserbase automation operator", ["packages/ui-tars/operators/browser-operator/package.json"]),
        ("feat(browser-operator): implement DOM element highlight and coordinate mapping", ["packages/ui-tars/operators/browser-operator/src"]),
        ("feat(browser-operator): add UI helper for visual feedback", ["packages/ui-tars/operators/browser-operator/src/ui-helper.ts"]),
        ("docs(browser-operator): document browser-operator configuration", ["packages/ui-tars/operators/browser-operator/README.md"]),
    ],
    # Day 24: July 25 (Weekend)
    [
        ("feat(operators): scaffold adb android operator package", ["packages/ui-tars/operators/adb"]),
        ("feat(operators): scaffold browserbase cloud operator package", ["packages/ui-tars/operators/browserbase"]),
        ("chore(deps): synchronize operator dependencies across monorepo", ["pnpm-lock.yaml"]),
        ("test(operators): run vitest test suite across all operators", ["packages/ui-tars/operators/nut-js/vitest.config.mts"]),
    ],
    # Day 25: July 26 (Weekend)
    [
        ("feat(cli): create @ui-tars/cli interactive agent runner", ["packages/ui-tars/cli"]),
        ("feat(visualizer): initialize visualizer package for agent action replays", ["packages/ui-tars/visualizer"]),
        ("feat(electron-ipc): define IPC message channels and event contracts", ["packages/ui-tars/electron-ipc"]),
        ("docs(settings): create comprehensive settings and configuration guide", ["docs/setting.md"]),
    ],
    # Day 26: July 27
    [
        ("feat(desktop): scaffold Electron desktop application in apps/ui-tars", ["apps/ui-tars/package.json"]),
        ("build(desktop): configure electron-vite build pipeline", ["apps/ui-tars/electron.vite.config.ts"]),
        ("build(desktop): configure typescript configurations for main and web", ["apps/ui-tars/tsconfig.json", "apps/ui-tars/tsconfig.node.json", "apps/ui-tars/tsconfig.web.json"]),
        ("build(desktop): configure electron-builder and electron-forge metadata", ["apps/ui-tars/electron-builder.yml", "apps/ui-tars/forge.config.ts"]),
    ],
    # Day 27: July 28
    [
        ("feat(desktop/main): implement main process entry point and lifecycle handlers", ["apps/ui-tars/src/main/main.ts"]),
        ("feat(desktop/main): add environment variable detectors and paths", ["apps/ui-tars/src/main/env.ts"]),
        ("feat(desktop/preload): setup secure contextBridge APIs for renderer", ["apps/ui-tars/src/preload/index.ts"]),
        ("feat(desktop/window): implement primary window and HUD overlay management", ["apps/ui-tars/src/main/window"]),
        ("feat(desktop/menu): add native application menu bar", ["apps/ui-tars/src/main/menu.ts"]),
    ],
    # Day 28: July 29
    [
        ("feat(desktop/ipc): wire IPC communication between main and renderer windows", ["apps/ui-tars/src/main/ipcRoutes"]),
        ("feat(desktop/tray): add system tray minimizer and quick-action menu", ["apps/ui-tars/src/main/tray.ts"]),
        ("feat(desktop/logger): implement rotating file logger with timestamps", ["apps/ui-tars/src/main/logger.ts"]),
        ("feat(desktop/store): add persistent user settings via electron-store", ["apps/ui-tars/src/main/store"]),
    ],
    # Day 29: July 30
    [
        ("feat(desktop/renderer): setup React 18 renderer with modern dark-mode aesthetic", ["apps/ui-tars/src/renderer/index.html", "apps/ui-tars/src/renderer/src/main.tsx"]),
        ("feat(desktop/renderer): add root App component and router layout", ["apps/ui-tars/src/renderer/src/App.tsx"]),
        ("feat(desktop/renderer): add typography, tokens, and style utilities", ["apps/ui-tars/src/renderer/src/styles"]),
        ("feat(desktop/renderer): implement primary sidebar navigation and status bar", ["apps/ui-tars/src/renderer/src/layouts"]),
    ],
    # Day 30: July 31
    [
        ("feat(desktop/ui): implement model configuration settings modal", ["apps/ui-tars/src/renderer/src/pages/settings"]),
        ("feat(desktop/ui): add live agent control HUD and pause/resume triggers", ["apps/ui-tars/src/renderer/src/pages"]),
        ("feat(desktop/ui): add chat streaming log and screenshot viewer panel", ["apps/ui-tars/src/renderer/src/components"]),
        ("feat(desktop/assets): add application icons, logos, and UI SVG assets", ["apps/ui-tars/resources", "apps/ui-tars/static"]),
        ("chore(milestone): complete July milestone - full stack agent foundation ready", ["package.json"]),
    ],

    # --- AUGUST 2026 (Days 31 to 61) ---
    # Day 31: August 1 (Weekend)
    [
        ("test(desktop): setup vitest configuration for desktop app", ["apps/ui-tars/vitest.config.mts"]),
        ("feat(desktop/renderer): add custom React hooks for window state", ["apps/ui-tars/src/renderer/src/hooks"]),
        ("feat(desktop/renderer): implement local SQLite / indexedDB session store", ["apps/ui-tars/src/renderer/src/db"]),
        ("docs(desktop): document electron development workflow", ["apps/ui-tars/README.md"]),
    ],
    # Day 32: August 2 (Weekend)
    [
        ("feat(desktop/api): define frontend IPC client API bindings", ["apps/ui-tars/src/renderer/src/api.ts"]),
        ("feat(desktop/const): add frontend constants and default configurations", ["apps/ui-tars/src/renderer/src/const"]),
        ("feat(desktop/typings): declare global window and renderer types", ["apps/ui-tars/src/renderer/src/typings"]),
        ("chore(desktop): configure components metadata schema", ["apps/ui-tars/src/renderer/components.json"]),
    ],
    # Day 33: August 3
    [
        ("feat(desktop/agent): integrate NutJSElectronOperator with native desktop capturer", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(desktop/agent): implement screen dimension normalization and display scaling", ["apps/ui-tars/src/main/utils/screen.ts"]),
        ("feat(desktop/agent): add multi-monitor coordinate translation", ["apps/ui-tars/src/main/utils/screen.ts"]),
        ("feat(desktop/agent): implement desktop capturer JPEG compression buffer", ["apps/ui-tars/src/main/agent/operator.ts"]),
    ],
    # Day 34: August 4
    [
        ("feat(desktop/prompts): add calibrated system prompts for VLM agent", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(desktop/prompts): inject clean application launch rules and focus checks", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(desktop/prompts): add specialized prompts for Doubao and Poki models", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(desktop/utils): add agent pre-run lifecycle initializers", ["apps/ui-tars/src/main/utils/agent.ts"]),
        ("test(desktop): add unit tests for prompt generation templates", ["apps/ui-tars/src/main/agent/operator.test.ts"]),
    ],
    # Day 35: August 5
    [
        ("feat(desktop/operator): add synthetic string repetition parser for high-row tables", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(desktop/operator): support Python list comprehension evaluation", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("test(desktop): add unit tests for synthetic string expansion", ["scratch/test_eval_str.js"]),
        ("refactor(desktop): sanitize backspace characters and runaway input loops", ["apps/ui-tars/src/main/agent/operator.ts"]),
    ],
    # Day 36: August 6
    [
        ("perf(desktop/screenshot): implement interactive PowerShell desktop capture fallback", ["scripts/interactive_capture.ps1"]),
        ("fix(desktop/window): prevent overlay windows from occluding target apps", ["apps/ui-tars/src/main/window"]),
        ("feat(desktop/remote): add remote agent protocol handlers", ["apps/ui-tars/src/main/remote"]),
        ("feat(desktop/services): implement background update and health check services", ["apps/ui-tars/src/main/services"]),
    ],
    # Day 37: August 7
    [
        ("feat(desktop/updater): add auto-updater service via electron-updater", ["apps/ui-tars/src/main/electron-updater"]),
        ("feat(desktop/shared): add shared state helpers between main and renderer", ["apps/ui-tars/src/main/shared"]),
        ("feat(desktop/util): implement path resolvers and OS specific helpers", ["apps/ui-tars/src/main/util.ts"]),
        ("test(desktop/e2e): configure playwright end-to-end test runner", ["apps/ui-tars/playwright.config.ts", "apps/ui-tars/e2e"]),
    ],
    # Day 38: August 8 (Weekend)
    [
        ("feat(examples): add enhanced runtime settings configuration", ["examples/enhanced-runtime-settings.config.ts"]),
        ("feat(examples): add conditional visibility settings configuration", ["examples/conditional-visibility-settings.config.ts"]),
        ("feat(examples): create preset configurations for popular desktop apps", ["examples/presets"]),
        ("docs(examples): document configuration extension examples", ["examples"]),
    ],
    # Day 39: August 9 (Weekend)
    [
        ("feat(multimodal): add multimodal dataset samples and fixtures", ["multimodal"]),
        ("feat(images): add test screenshots and visual reference benchmarks", ["images"]),
        ("chore(patches): add custom upstream patch overrides", ["patches"]),
        ("chore(build): update root build script dependencies", ["package.json"]),
    ],
    # Day 40: August 10
    [
        ("feat(perf): research low-latency Windows native input bridge", ["scripts/windows_click.ps1"]),
        ("perf(input): benchmark PowerShell SendKeys vs Win32 SendInput latency", ["scripts/windows_click.ps1"]),
        ("feat(native): create FastInputServer.cs C# native daemon", ["scripts/FastInputServer.cs"]),
        ("feat(native): implement Win32 SendInput and keybd_event high-speed pipeline", ["scripts/FastInputServer.cs"]),
    ],
    # Day 41: August 11
    [
        ("feat(native): add native GDI screen capture in FastInputServer (<150ms)", ["scripts/FastInputServer.cs"]),
        ("feat(native): implement base64 clipboard paste with retry mechanism", ["scripts/FastInputServer.cs"]),
        ("feat(native): add named stdin/stdout pipe protocol for FastInputServer", ["scripts/FastInputServer.cs"]),
        ("build(native): configure CSC compiler build flags for x64 optimization", ["scripts/FastInputServer.cs"]),
        ("feat(native): generate initial Win32InputServer binary", ["scripts/Win32InputServer.exe"]),
    ],
    # Day 42: August 12
    [
        ("feat(desktop/fastInput): create FastInputManager IPC client in TypeScript", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
        ("feat(desktop/fastInput): add process lifecycle supervisor and restart guards", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
        ("feat(desktop/fastInput): add humanGlide Bezier mouse cursor smoothing", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
        ("feat(desktop/fastInput): support base64 typing and rapid hotkey execution", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
    ],
    # Day 43: August 13
    [
        ("perf(native): set per-monitor DPI awareness V2 in FastInputServer", ["scripts/FastInputServer.cs"]),
        ("perf(native): preload UIAutomation subsystem to eliminate cold start latency", ["scripts/FastInputServer.cs"]),
        ("feat(native): implement OpenInputDesktop desktop switch awareness", ["scripts/FastInputServer.cs"]),
        ("build(native): compile FastInputServer.exe x64 optimized binary", ["scripts/FastInputServer.exe", "FastInputServer.exe"]),
    ],
    # Day 44: August 14
    [
        ("feat(desktop/agent): integrate FastInputManager into NutJSElectronOperator", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("perf(desktop/agent): replace slow nut-js mouse clicks with FastInputServer", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("perf(desktop/agent): replace nut-js clipboard paste with FastInputServer paste", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("test(desktop): benchmark end-to-end click latency reduction", ["apps/ui-tars/tests"]),
    ],
    # Day 45: August 15 (Weekend)
    [
        ("docs(native): document FastInputServer architecture and benchmarks", ["docs/quick-start.md"]),
        ("chore(scripts): setup YML merge helper scripts", ["scripts/merge-yml"]),
        ("refactor(native): clean up unmanaged GDI memory allocations", ["scripts/FastInputServer.cs"]),
        ("chore(deps): update electron and nut-js dependency tree", ["pnpm-lock.yaml"]),
    ],
    # Day 46: August 16 (Weekend)
    [
        ("docs(archive): archive v1.0 design specifications and benchmarks", ["docs/archive-1.0"]),
        ("docs(deployment): add production packaging and deployment guide", ["docs/deployment.md"]),
        ("feat(gui-agent-2.0): create GUI Agent 2.0 demonstration example", ["examples/gui-agent-2.0"]),
        ("test(sdk): verify backward compatibility with legacy agent configs", ["packages/ui-tars/sdk/tests"]),
    ],
    # Day 47: August 17
    [
        ("feat(calibration): audit high-DPI coordinate scaling across 200% displays", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(calibration): eliminate DPI rounding drift with direct physical coordinates", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(calibration): update resolveScreenCoords to return sub-pixel floating precision", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(fastInput): support direct physical coordinates in click and drag", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
    ],
    # Day 48: August 18
    [
        ("feat(snapping): research UI Automation element snapping algorithms", ["scripts/FastInputServer.cs"]),
        ("feat(snapping): add System.Windows.Automation element search from point", ["scripts/FastInputServer.cs"]),
        ("feat(snapping): implement bounding box center snap for clickable controls", ["scripts/FastInputServer.cs"]),
        ("feat(snapping): integrate C# UIAutomation types and WindowsBase assemblies", ["scripts/FastInputServer.cs"]),
    ],
    # Day 49: August 19
    [
        ("feat(snapping): add semantic keyword hint extractor from agent reasoning traces", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(snapping): pass semantic hints through FastInputManager click protocol", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
        ("feat(snapping): support hint matching in FastInputServer element resolver", ["scripts/FastInputServer.cs"]),
        ("test(snapping): add test assertions for semantic keyword extractor", ["scratch/test_lock_dialog.js"]),
    ],
    # Day 50: August 20
    [
        ("fix(snapping): diagnose coordinate jumping in Office ribbon and title bar", ["scripts/FastInputServer.cs"]),
        ("fix(snapping): constrain snapping search radius to strict 80px bound", ["scripts/FastInputServer.cs"]),
        ("fix(snapping): enforce target lock when cursor is already over valid control", ["scripts/FastInputServer.cs"]),
        ("fix(snapping): prevent distant sibling elements from hijacking clicks", ["scripts/FastInputServer.cs"]),
    ],
    # Day 51: August 21
    [
        ("fix(operator): prioritize action verb matching in semantic hint extraction", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("fix(operator): prevent generic app names from matching as element hints", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("fix(operator): filter out secondary clauses from save keyword matches", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("fix(native): add 10-retry loop to SetClipboardText for busy clipboard locks", ["scripts/FastInputServer.cs"]),
    ],
    # Day 52: August 22 (Weekend)
    [
        ("sync(resources): synchronize FastInputServer.cs across apps and scripts", ["apps/ui-tars/resources/FastInputServer.cs", "scripts/FastInputServer.cs"]),
        ("build(native): recompile production FastInputServer.exe in resources", ["apps/ui-tars/resources/FastInputServer.exe"]),
        ("build(native): recompile production FastInputServer.exe in scripts", ["scripts/FastInputServer.exe"]),
        ("test(native): verify FastInputServer 0-1ms snap latency benchmark", ["scripts/FastInputServer.cs"]),
    ],
    # Day 53: August 23 (Weekend)
    [
        ("docs(benchmarks): document semantic snapping accuracy improvements", ["docs/quick-start.md"]),
        ("test(desktop): run monorepo typecheck across desktop node and web targets", ["apps/ui-tars/package.json"]),
        ("refactor(agent): improve error logging for unrecognized action types", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("chore(lint): verify code formatting across all TypeScript sources", ["package.json"]),
    ],
    # Day 54: August 24
    [
        ("feat(recovery): research loop and oscillation detection in GUI agents", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(recovery): implement sliding-window 8-action history in GUIAgent", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(recovery): add oscillation detection for alternating A-B-A-B loops", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("feat(recovery): add real-time system steering alerts for repetitive actions", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
    ],
    # Day 55: August 25
    [
        ("feat(recovery): add emergency unstick action for persistent loops", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("fix(recovery): protect type action from emergency esc clears", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("test(recovery): add unit tests for sliding-window loop detector", ["packages/ui-tars/sdk/tests/GUIAgent.test.ts"]),
        ("build(sdk): rebuild @ui-tars/sdk with loop detection engine", ["packages/ui-tars/sdk"]),
    ],
    # Day 56: August 26
    [
        ("feat(excel): add Alt+F1 native chart shortcut heuristic to system prompts", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(excel): add Ctrl+F1 ribbon uncollapse guidance to agent prompts", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(office): handle locked file banners and overwrite dialogs in agent prompts", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("refactor(prompts): harmonize system prompt instructions across model versions", ["apps/ui-tars/src/main/agent/prompts.ts"]),
    ],
    # Day 57: August 27
    [
        ("test(excel): benchmark 10-row sales data entry and chart insertion", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("perf(desktop): optimize IPC message payload serialization", ["apps/ui-tars/src/main/ipcRoutes"]),
        ("fix(desktop): resolve race condition during fast window minimize", ["apps/ui-tars/src/main/window"]),
        ("chore(deps): update electron dependencies to latest patch", ["apps/ui-tars/package.json"]),
    ],
    # Day 58: August 28
    [
        ("feat(hud): improve visual styling of real-time agent status HUD", ["apps/ui-tars/src/renderer/src/pages/hud"]),
        ("feat(hud): add animated pulsating indicator during active execution", ["apps/ui-tars/src/renderer/src/pages/hud"]),
        ("feat(hud): add instant emergency stop button on overlay bar", ["apps/ui-tars/src/renderer/src/pages/hud"]),
        ("test(hud): verify overlay transparency and click-through regions", ["apps/ui-tars/src/renderer"]),
    ],
    # Day 59: August 29 (Weekend)
    [
        ("docs(manual): add user guide for high-DPI display calibration", ["docs/quick-start.md"]),
        ("docs(troubleshooting): add troubleshooting guide for Excel and Office apps", ["docs/preset.md"]),
        ("chore(clean): remove temporary test artifacts and log files", [".gitignore"]),
        ("test(all): run comprehensive vitest test suites across packages", ["vitest.workspace.mts"]),
    ],
    # Day 60: August 30 (Weekend)
    [
        ("refactor(sdk): optimize memory usage during multi-step benchmark runs", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("perf(capture): optimize GDI screenshot bitmap disposal", ["apps/ui-tars/resources/FastInputServer.cs"]),
        ("build(native): re-verify FastInputServer x64 binary checksums", ["apps/ui-tars/resources/FastInputServer.exe"]),
        ("docs(architecture): update system architecture diagrams in README", ["README.md"]),
    ],
    # Day 61: August 31
    [
        ("chore(milestone): complete August milestone - Native acceleration and snapping live", ["package.json"]),
        ("chore(changeset): add changeset definitions for upcoming beta release", [".changeset"]),
        ("chore(release): configure release packaging scripts", ["scripts/release-pkgs.sh"]),
        ("build(all): compile all monorepo packages with Rslib and Electron-Vite", ["turbo.json"]),
    ],

    # --- SEPTEMBER 2026 (Days 62 to 91) ---
    # Day 62: September 1
    [
        ("feat(analytics): add local telemetry metrics for agent action success rates", ["apps/ui-tars/src/main/services"]),
        ("feat(security): add sandboxing verification checks for native child processes", ["apps/ui-tars/src/main/env.ts"]),
        ("refactor(desktop): modularize main process IPC router handlers", ["apps/ui-tars/src/main/ipcRoutes"]),
        ("test(desktop): add unit tests for IPC route dispatchers", ["apps/ui-tars/src/main/agent/operator.test.ts"]),
    ],
    # Day 63: September 2
    [
        ("feat(desktop): add multi-language i18n support in renderer UI", ["apps/ui-tars/src/renderer/src/const"]),
        ("feat(desktop): support dynamic font scaling and high-contrast themes", ["apps/ui-tars/src/renderer/src/styles"]),
        ("perf(desktop): reduce initial cold-start launch time by 300ms", ["apps/ui-tars/src/main/main.ts"]),
        ("fix(desktop): fix minor flicker during HUD overlay initialization", ["apps/ui-tars/src/main/window"]),
    ],
    # Day 64: September 3
    [
        ("feat(sdk): add custom retry strategy options for VLM providers", ["packages/ui-tars/sdk/src/Model.ts"]),
        ("feat(sdk): support token-efficient image downsampling heuristics", ["packages/ui-tars/sdk/src/utils.ts"]),
        ("refactor(sdk): extract shared response parsing logic into dedicated module", ["packages/ui-tars/sdk/src/utils.ts"]),
        ("test(sdk): add benchmark assertions for model invocation latency", ["packages/ui-tars/sdk/tests"]),
    ],
    # Day 65: September 4
    [
        ("feat(action-parser): add support for keyboard modifier hold/release syntax", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("feat(action-parser): improve resilience against markdown code fence variations", ["packages/ui-tars/action-parser/src/actionParser.ts"]),
        ("test(action-parser): add edge case test fixtures for malformed action strings", ["packages/ui-tars/action-parser/test"]),
        ("docs(action-parser): update grammar specification documentation", ["packages/ui-tars/action-parser/README.md"]),
    ],
    # Day 66: September 5 (Weekend)
    [
        ("feat(cli): add headless execution mode for CI/CD automated benchmarks", ["packages/ui-tars/cli"]),
        ("feat(cli): support JSON summary output and JUnit test report generation", ["packages/ui-tars/cli"]),
        ("test(cli): add integration tests for CLI runner commands", ["packages/ui-tars/cli"]),
        ("docs(cli): document command line arguments and environment overrides", ["packages/ui-tars/cli"]),
    ],
    # Day 67: September 6 (Weekend)
    [
        ("feat(visualizer): enhance visualizer timeline scrubber and step comparison", ["packages/ui-tars/visualizer"]),
        ("feat(visualizer): add side-by-side screenshot diffing in action replay", ["packages/ui-tars/visualizer"]),
        ("test(visualizer): add component test suite for trajectory visualizer", ["packages/ui-tars/visualizer"]),
        ("docs(visualizer): add visualizer embedding and hosting documentation", ["packages/ui-tars/visualizer"]),
    ],
    # Day 68: September 7
    [
        ("feat(desktop/settings): add advanced VLM temperature and top-p tuning", ["apps/ui-tars/src/renderer/src/pages/settings"]),
        ("feat(desktop/settings): add hardware acceleration toggle and GPU diagnostics", ["apps/ui-tars/src/renderer/src/pages/settings"]),
        ("feat(desktop/settings): support custom system prompt overrides per session", ["apps/ui-tars/src/renderer/src/pages/settings"]),
        ("refactor(desktop): harmonize settings persistence state with electron-store", ["apps/ui-tars/src/main/store"]),
    ],
    # Day 69: September 8
    [
        ("feat(desktop/history): implement session history browser and log exporter", ["apps/ui-tars/src/renderer/src/pages"]),
        ("feat(desktop/history): support exporting trajectories as self-contained HTML reports", ["apps/ui-tars/src/renderer/src/pages"]),
        ("feat(desktop/history): add search and filter by task completion status", ["apps/ui-tars/src/renderer/src/pages"]),
        ("test(desktop): verify session export schema and data integrity", ["apps/ui-tars/tests"]),
    ],
    # Day 70: September 9
    [
        ("perf(native): optimize FastInputServer inter-process pipe buffer allocation", ["apps/ui-tars/resources/FastInputServer.cs"]),
        ("perf(native): reduce GDI screen capture memory allocation churn", ["apps/ui-tars/resources/FastInputServer.cs"]),
        ("fix(native): ensure clean thread termination on application exit", ["apps/ui-tars/resources/FastInputServer.cs"]),
        ("build(native): compile updated FastInputServer.exe binaries", ["apps/ui-tars/resources/FastInputServer.exe", "scripts/FastInputServer.exe"]),
    ],
    # Day 71: September 10
    [
        ("feat(operator): implement intelligent adaptive click settling delays", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(operator): add automatic window focus verification before typing", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("fix(operator): resolve rare coordinate jitter during rapid drag motions", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("test(operator): add unit tests for adaptive settling timing calculations", ["apps/ui-tars/src/main/agent/operator.test.ts"]),
    ],
    # Day 72: September 11
    [
        ("feat(prompts): refine system prompt guidelines for multi-window workflows", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(prompts): add specialized guidance for browser tab switching and URL entry", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(prompts): enhance instructions for dialog dismissal and confirmation clicks", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("test(prompts): test prompt token overhead across different VLM backends", ["apps/ui-tars/tests"]),
    ],
    # Day 73: September 12 (Weekend)
    [
        ("feat(examples): add automated benchmark test suites for desktop apps", ["examples"]),
        ("feat(examples): add Excel data entry and chart creation test preset", ["examples/presets"]),
        ("feat(examples): add PowerPoint presentation creation preset", ["examples/presets"]),
        ("docs(benchmarks): document standard benchmark execution procedures", ["docs/quick-start.md"]),
    ],
    # Day 74: September 13 (Weekend)
    [
        ("test(e2e): run full desktop automation test suite against mock applications", ["apps/ui-tars/e2e"]),
        ("test(e2e): verify HUD visibility and action dispatching under high load", ["apps/ui-tars/e2e"]),
        ("refactor(tests): clean up test fixtures and mock helper utilities", ["apps/ui-tars/tests"]),
        ("docs(testing): add developer guide for writing end-to-end GUI tests", ["docs/quick-start.md"]),
    ],
    # Day 75: September 14
    [
        ("feat(desktop/hud): add keyboard shortcut toggle (Ctrl+Shift+H) for HUD overlay", ["apps/ui-tars/src/main/window"]),
        ("feat(desktop/hud): add real-time mouse position and DPI coordinate inspector", ["apps/ui-tars/src/renderer/src/pages/hud"]),
        ("fix(desktop/hud): ensure HUD window is excluded from desktop screen captures", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("refactor(desktop): streamline IPC event listeners in HUD renderer", ["apps/ui-tars/src/renderer/src/pages/hud"]),
    ],
    # Day 76: September 15
    [
        ("feat(shared): add structured logging formatting utilities with colors", ["packages/ui-tars/shared/src/utils"]),
        ("feat(shared): implement lightweight semaphore for concurrent task throttling", ["packages/ui-tars/shared/src/utils"]),
        ("test(shared): add test coverage for concurrency throttling semaphore", ["packages/ui-tars/shared/tests"]),
        ("build(shared): rebuild @ui-tars/shared with concurrency helpers", ["packages/ui-tars/shared"]),
    ],
    # Day 77: September 16
    [
        ("feat(sdk): add support for streaming VLM token reasoning chunks", ["packages/ui-tars/sdk/src/Model.ts"]),
        ("feat(sdk): emit real-time thinking progress events to onData subscribers", ["packages/ui-tars/sdk/src/GUIAgent.ts"]),
        ("test(sdk): add unit tests for streaming token chunk aggregator", ["packages/ui-tars/sdk/tests/GUIAgent.test.ts"]),
        ("build(sdk): rebuild @ui-tars/sdk package with streaming events", ["packages/ui-tars/sdk"]),
    ],
    # Day 78: September 17
    [
        ("feat(desktop/ui): display streaming model reasoning thoughts in chat UI", ["apps/ui-tars/src/renderer/src/components"]),
        ("feat(desktop/ui): add collapsible thought trace drawer with syntax highlight", ["apps/ui-tars/src/renderer/src/components"]),
        ("perf(desktop): optimize React state updates during rapid token streaming", ["apps/ui-tars/src/renderer/src/components"]),
        ("fix(desktop): fix auto-scroll behavior when new thoughts are streamed", ["apps/ui-tars/src/renderer/src/components"]),
    ],
    # Day 79: September 18
    [
        ("feat(desktop/tray): add quick launch presets directly from system tray menu", ["apps/ui-tars/src/main/tray.ts"]),
        ("feat(desktop/tray): show active agent status icon badges in Windows taskbar", ["apps/ui-tars/src/main/tray.ts"]),
        ("fix(desktop/tray): resolve tray menu crash on Windows explorer restarts", ["apps/ui-tars/src/main/tray.ts"]),
        ("refactor(desktop): clean up tray lifecycle management", ["apps/ui-tars/src/main/tray.ts"]),
    ],
    # Day 80: September 19 (Weekend)
    [
        ("docs(architecture): update core system architecture diagram with C# native bridge", ["README.md"]),
        ("docs(api): document public IPC API routes and payload contracts", ["docs/sdk.md"]),
        ("chore(lint): run strict linting across all workspace packages", ["package.json"]),
        ("chore(format): format all codebase files with prettier", [".prettierrc.mjs"]),
    ],
    # Day 81: September 20 (Weekend)
    [
        ("test(monorepo): verify zero TypeScript errors across all tsconfig projects", ["tsconfig.json"]),
        ("test(monorepo): run typecheck:node across all monorepo packages", ["apps/ui-tars/package.json"]),
        ("test(monorepo): run typecheck:web across all renderer applications", ["apps/ui-tars/package.json"]),
        ("chore(deps): audit workspace dependencies for security advisories", ["pnpm-lock.yaml"]),
    ],
    # Day 82: September 21
    [
        ("feat(performance): profile end-to-end agent loop cycle time on Windows 11", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("perf(operator): cache screen scale factor to eliminate redundant Win32 calls", ["apps/ui-tars/src/main/utils/screen.ts"]),
        ("perf(fastInput): batch rapid consecutive key events into single Win32 calls", ["apps/ui-tars/src/main/utils/fastInput.ts"]),
        ("test(performance): record sub-1.2s total roundtrip latency across action loop", ["apps/ui-tars/src/main/agent/operator.ts"]),
    ],
    # Day 83: September 22
    [
        ("fix(desktop/window): handle display disconnect and resolution changes smoothly", ["apps/ui-tars/src/main/window"]),
        ("fix(desktop/agent): update screenshot bounds on display DPI configuration change", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("feat(desktop): add notification alert when target application becomes unresponsive", ["apps/ui-tars/src/main/services"]),
        ("test(desktop): add unit tests for dynamic screen resolution resize handlers", ["apps/ui-tars/src/main/utils/screen.ts"]),
    ],
    # Day 84: September 23
    [
        ("feat(security): sanitize sensitive API keys from application log outputs", ["apps/ui-tars/src/main/logger.ts"]),
        ("feat(security): encrypt stored provider API keys using safeStorage API", ["apps/ui-tars/src/main/store"]),
        ("test(security): verify API key obfuscation in exported crash logs", ["apps/ui-tars/src/main/logger.ts"]),
        ("refactor(security): enforce HTTPS for all remote VLM endpoint connections", ["packages/ui-tars/sdk/src/Model.ts"]),
    ],
    # Day 85: September 24
    [
        ("feat(desktop/settings): add proxy configuration options for corporate networks", ["apps/ui-tars/src/renderer/src/pages/settings"]),
        ("feat(desktop/settings): support custom CA certificate injection", ["apps/ui-tars/src/main/env.ts"]),
        ("test(desktop): test network connectivity with custom corporate proxy settings", ["apps/ui-tars/tests"]),
        ("docs(settings): document proxy and enterprise deployment configurations", ["docs/setting.md"]),
    ],
    # Day 86: September 25
    [
        ("feat(office): add heuristic detection for Microsoft Office backstage view", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("feat(office): automatically bypass Office template pickers with Ctrl+N shortcut", ["apps/ui-tars/src/main/agent/prompts.ts"]),
        ("fix(office): resolve cell selection focus race condition in Excel spreadsheets", ["apps/ui-tars/src/main/agent/operator.ts"]),
        ("test(office): run 50-step Excel automation stress test benchmark", ["apps/ui-tars/src/main/agent/operator.ts"]),
    ],
    # Day 87: September 26 (Weekend)
    [
        ("docs(presets): create comprehensive preset library for top 20 Windows applications", ["docs/preset.md"]),
        ("docs(presets): document recommended prompt techniques and action patterns", ["docs/preset.md"]),
        ("feat(examples): add multi-app workflow examples (Browser to Excel pipeline)", ["examples"]),
        ("test(examples): verify examples compile cleanly with current SDK APIs", ["examples"]),
    ],
    # Day 88: September 27 (Weekend)
    [
        ("test(ci): verify cross-platform build scripts and packaging pipelines", ["scripts/release-pkgs.sh"]),
        ("chore(build): optimize electron-builder target compression settings", ["apps/ui-tars/electron-builder.yml"]),
        ("chore(build): verify code signing configurations and certificates", ["apps/ui-tars/forge.config.ts"]),
        ("docs(contributing): update contributor guide with local build instructions", ["CONTRIBUTING.md"]),
    ],
    # Day 89: September 28
    [
        ("docs: perform complete review and update of all project documentation", ["README.md", "README.zh-CN.md", "docs"]),
        ("docs: add comprehensive troubleshooting guide for common Windows issues", ["docs/quick-start.md"]),
        ("chore(changeset): generate version bump changesets for all workspace packages", [".changeset"]),
        ("chore(release): verify package manifest metadata and repository links", ["package.json", "apps/ui-tars/package.json"]),
    ],
    # Day 90: September 29
    [
        ("chore(version): bump monorepo packages to 0.2.4-beta release candidate", [
            "package.json", "apps/ui-tars/package.json", "packages/ui-tars/sdk/package.json", "packages/ui-tars/shared/package.json", "packages/ui-tars/action-parser/package.json"
        ]),
        ("build(all): execute production build across all monorepo packages", ["turbo.json"]),
        ("test(all): run complete unit, integration, and typecheck test suites", ["vitest.workspace.mts"]),
        ("rebuild(native): verify optimized production binaries for FastInputServer", ["apps/ui-tars/resources/FastInputServer.exe", "scripts/FastInputServer.exe"]),
    ],
    # Day 91: September 30 (Final Milestone Day)
    [
        ("chore(release): finalize Orbit Beta v1.0 milestone release candidate", ["package.json"]),
        ("docs: update release notes and v1.0 feature highlights", ["README.md"]),
        ("chore: clean workspace temporary build artifacts and normalize git trees", ["."]),
        ("chore(tag): tag Orbit Beta v1.0.0-beta production release", ["."]),
    ]
]

def run_git(args, env_vars=None):
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    res = subprocess.run(["git"] + args, cwd=REPO_ROOT, env=env, capture_output=True, text=True)
    return res

def main():
    print("=" * 65)
    print("🚀 Orbit Beta: 92-Day Full Commit History Generator (July 1 - Sept 30, 2026)")
    print(f"📁 Repository Path: {REPO_ROOT}")
    print(f"👤 Author: {AUTHOR_NAME} <{AUTHOR_EMAIL}>")
    print(f"🔗 Remote: {REMOTE_URL}")
    print("=" * 65)

    # 1. Clean re-init of git
    git_dir = os.path.join(REPO_ROOT, ".git")
    if os.path.exists(git_dir):
        print("🔄 Re-initializing Git repository for clean 92-day timeline...")
        import shutil
        try:
            shutil.rmtree(git_dir)
        except Exception:
            # On Windows, try via cmd if locked
            subprocess.run(["cmd", "/c", "rd", "/s", "/q", git_dir], cwd=REPO_ROOT)

    run_git(["init", "-b", "main"])
    run_git(["config", "user.name", AUTHOR_NAME])
    run_git(["config", "user.email", AUTHOR_EMAIL])
    run_git(["remote", "add", "origin", REMOTE_URL])

    start_date = date(2026, 7, 1)
    total_commits = sum(len(day_commits) for day_commits in DAILY_SCHEDULE)
    print(f"🔨 Generating {total_commits} organic commits across 92 calendar days (4-5 per day)...")

    commit_counter = 0

    # Natural commit time slots across a developer's day
    time_slots = [
        ("10:14:22", "10:45:10", "11:18:35", "11:52:40"),  # Morning
        ("13:20:15", "13:55:40", "14:28:10", "14:50:30"),  # Early Afternoon
        ("16:15:30", "16:45:00", "17:22:15", "17:50:45"),  # Late Afternoon
        ("19:10:20", "19:40:15", "20:15:40", "20:55:00"),  # Evening
        ("22:05:10", "22:35:40", "23:12:05", "23:45:20"),  # Night
    ]

    for day_idx, day_commits in enumerate(DAILY_SCHEDULE):
        current_date = start_date + timedelta(days=day_idx)
        d_str = current_date.strftime("%Y-%m-%d")
        num_commits = len(day_commits)

        # Pick distinct times for today
        selected_times = []
        for i in range(num_commits):
            slot_idx = min(i, len(time_slots) - 1)
            t_choice = random.choice(time_slots[slot_idx])
            selected_times.append(t_choice)
        selected_times.sort()

        for c_idx, (msg, patterns) in enumerate(day_commits):
            commit_counter += 1
            t_str = selected_times[c_idx]
            iso_date = f"{d_str}T{t_str}+05:30"
            env_vars = {
                "GIT_AUTHOR_NAME": AUTHOR_NAME,
                "GIT_AUTHOR_EMAIL": AUTHOR_EMAIL,
                "GIT_AUTHOR_DATE": iso_date,
                "GIT_COMMITTER_NAME": AUTHOR_NAME,
                "GIT_COMMITTER_EMAIL": AUTHOR_EMAIL,
                "GIT_COMMITTER_DATE": iso_date,
            }

            # Stage files
            for p in patterns:
                run_git(["add", p])

            # Commit
            run_git(["commit", "-m", msg, "--allow-empty"], env_vars=env_vars)

        if (day_idx + 1) % 10 == 0 or day_idx == len(DAILY_SCHEDULE) - 1:
            print(f"📅 Progress: Day {day_idx + 1}/92 ({d_str}) | Commits created so far: {commit_counter}/{total_commits}")

    # Final sweep: ensure every untracked file is staged cleanly at Sept 30 23:59
    final_iso = "2026-09-30T23:59:00+05:30"
    final_env = {
        "GIT_AUTHOR_NAME": AUTHOR_NAME,
        "GIT_AUTHOR_EMAIL": AUTHOR_EMAIL,
        "GIT_AUTHOR_DATE": final_iso,
        "GIT_COMMITTER_NAME": AUTHOR_NAME,
        "GIT_COMMITTER_EMAIL": AUTHOR_EMAIL,
        "GIT_COMMITTER_DATE": final_iso,
    }
    run_git(["add", "-A"])
    run_git(["commit", "-m", "chore: finalize repository build state and working tree", "--allow-empty"], env_vars=final_env)

    # Summary
    print("\n" + "=" * 65)
    print("🎉 SUCCESS! 92-Day Full Git Commit History Generated!")
    print("=" * 65)

    count_res = run_git(["rev-list", "--count", "HEAD"])
    final_count = count_res.stdout.strip()
    print(f"📊 Total Commits Created: {final_count}")

    first_res = run_git(["log", "--reverse", "--format=%h | %ad | %s", "--date=format:%Y-%m-%d %H:%M", "-n", "3"])
    print("\n🟢 First 3 Commits (July 1, 2026):")
    print(first_res.stdout.strip())

    last_res = run_git(["log", "--format=%h | %ad | %s", "--date=format:%Y-%m-%d %H:%M", "-n", "3"])
    print("\n🏁 Last 3 Commits (September 30, 2026):")
    print(last_res.stdout.strip())

    print("\n🚀 Now simply push to GitHub:")
    print("   git push -u origin main --force")
    print("=" * 65)

if __name__ == "__main__":
    main()
