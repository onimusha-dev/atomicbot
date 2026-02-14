# Electron Desktop — Agent Guidelines

## Scope

- This is a standalone Electron app (`apps/electron-desktop/`).
- **Never modify files outside `apps/electron-desktop/`** — core project code, root configs, and other apps are off-limits.
- **Never use scripts from the core project** (e.g. `scripts/committer`, root `pnpm` scripts). Use only local commands described below.
- **Never commit without explicit user permission.** Always ask before running `git add`, `git commit`, or any staging/commit operation.

## Testing

- Run tests: `npx vitest run --config vitest.config.ts` from `apps/electron-desktop/`.
- Always run tests after any file moves or import changes.

## Renderer UI Architecture (Feature-based)

Source: `renderer/src/`

```
renderer/src/
├── main.tsx              # entry point (Provider, HashRouter, global CSS imports)
├── env.d.ts              # ambient type declarations for window.openclawDesktop
├── gateway/              # gateway WebSocket RPC client + React context
├── ipc/                  # desktop IPC wrapper (desktopApi)
├── store/                # Redux store, typed hooks, slices (chat, config, gateway, onboarding)
└── ui/
    ├── app/              # app shell: App.tsx, routes.ts, ExecApprovalModal.tsx
    ├── chat/             # chat feature: ChatPage, ChatComposer, StartChatPage, messageParser, etc.
    ├── sidebar/          # sidebar: Sidebar, SessionSidebarItem
    ├── terminal/         # terminal: TerminalPage
    ├── updates/          # auto-update: UpdateBanner, WhatsNewModal
    ├── onboarding/       # onboarding & bootstrap (see sub-structure below)
    ├── settings/         # settings: SettingsPage + tabs + connector-modals/ + skill-modals/
    ├── shared/           # cross-feature shared code: kit/ (UI primitives), models/, toast, Toaster
    ├── styles/           # global CSS (base, layout, etc.)
    └── __tests__/        # smoke & integration tests
```

### Onboarding sub-structure

```
ui/onboarding/
├── ConsentScreen.tsx        # pre-onboarding consent
├── LoadingScreen.tsx        # loading / spinner screen
├── WelcomePage.tsx          # main onboarding orchestrator (renders all sub-pages via Routes)
├── connections/             # service connection pages (Telegram, Slack, Notion, etc.)
├── providers/               # provider & model selection pages (ProviderSelect, ApiKey, ModelSelect)
├── skills/                  # skill/feature setup pages (Skills, Gog, MediaUnderstanding, WebSearch)
└── hooks/                   # shared hooks, types, utils, constants for the onboarding flow
```

- `WelcomePage.tsx` imports page components from `connections/`, `providers/`, `skills/`.
- `hooks/` contains `useWelcomeState` (main state orchestrator) and domain hooks (`useWelcome*.ts`).
- `hooks/types.ts` exports `ConfigSnapshot` and `GatewayRpcLike` — also used by `settings/` modals.
- New onboarding connection page → `connections/`; new skill page → `skills/`; new provider page → `providers/`.

### Where to put new code

| What you're adding | Where it goes |
|---|---|
| New page / feature | Create a new dir under `ui/` (e.g. `ui/my-feature/`) |
| Component used by one feature | Inside that feature dir (e.g. `ui/chat/MyComponent.tsx`) |
| Component/util used by 2+ features | `ui/shared/` (kit for UI primitives, or top-level for utils) |
| New Redux slice | `store/slices/` (slices stay centralized) |
| New route | Register in `ui/app/routes.ts`, page component in the feature dir |
| Global CSS | `ui/styles/` |
| Per-component CSS | Next to the component file in its feature dir |

### Import conventions

- Features import from `../shared/` for shared UI kit, models, toast.
- Features import from `../../gateway/`, `../../ipc/`, `../../store/` for infra (two levels up from `ui/<feature>/`).
- Features import from `../app/routes` for route constants.
- Never use barrel re-exports between feature dirs — import directly from the source file.
- Tests colocate with their source files (`MyComponent.test.tsx` next to `MyComponent.tsx`).

## CSS Strategy

- **Per-component CSS**: lives next to the component (e.g. `chat/ChatComposer.css`).
- **Global CSS**: lives in `ui/styles/` and is imported once via `ui/styles/index.css` in `main.tsx`.
- Some component CSS is imported in `main.tsx` for global side-effect styles (Sidebar.css, chat transcript styles). Keep this pattern when adding new global-scope component styles.
