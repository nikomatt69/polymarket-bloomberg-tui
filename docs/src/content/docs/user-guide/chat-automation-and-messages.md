---
title: Chat, Automation, Messages
description: Operating the AI assistant, skills, automation rules, and message panels.
---

<div class="guide-intro">
  <strong>Objective:</strong> blend manual execution with assistant workflows. Keep chat,
  skills, and automation aligned with your current market focus to avoid context drift.
</div>

<div class="guide-kpi-grid">
  <div class="guide-kpi-item">
    <span>Open Chat</span>
    <strong>Enter</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Skills Panel</span>
    <strong>v</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Automation Panel</span>
    <strong>b</strong>
  </div>
  <div class="guide-kpi-item">
    <span>Messages Panel</span>
    <strong>Shift+M</strong>
  </div>
</div>

## Multi-Panel Command Deck

| Key | Surface | Effect |
| --- | --- | --- |
| `enter` | global | opens enterprise chat |
| `Ctrl+L` | chat input mode | clears chat transcript |
| `space` | chat tool list | expand/collapse selected tool output |
| `v` | global | opens skills panel |
| `b` | global | opens automation panel |
| `Shift+M` | global | opens messages panel |

## Enterprise Chat

Press `enter` from the global workspace to open enterprise chat.

### Input Mode

- `enter`: submit prompt
- `up` / `down`: prompt history when input is empty
- `Ctrl+U`: clear current input
- `Ctrl+L`: clear chat transcript
- `esc`: blur input

### Tool Inspector Mode

- `up` / `down` or `k` / `j`: move selected live tool call
- `space`: expand/collapse selected tool output
- `i` or `enter`: focus input again
- `esc`: close chat overlay

## Skills Panel

Toggle with `v`.

### List Mode

- `up` / `down`: select skill
- `space` or `enter`: enable/disable selected skill
- `+`: open add-skill mode
- `d`: delete selected custom skill (built-ins are protected)
- `esc`: close panel

### Add Mode

- `tab`: cycle fields (`name`, `description`, `systemPrompt`)
- `enter`: create skill when all fields are present
- `backspace` and typing: edit active field
- `esc`: return to list mode

## Automation Panel

Toggle with `b`.

- `tab` / `1` / `2`: switch between rules and scanner alerts
- `up` / `down`: change selection
- `space` or `enter` (rules): toggle rule enabled
- `d`: delete selected rule or scanner alert
- `c` (alerts tab): clear scanner alerts
- `esc`: close panel

## Messages Panel

Toggle with `Shift+M`.

- `tab`: switch between conversations and global chat
- `m`: start new direct-message flow in conversations mode
- `enter`: send message or confirm new conversation target
- `backspace` and typing: edit active input
- `esc`: close and reset messaging modes

## Related Panels

- `n`: news panel
- `t`: social panel
- `Ctrl+X`: profile panel
- `Ctrl+Y`: user search panel

These panels complement assistant and automation usage by providing context and communication channels.

<div class="guide-nav">
  <p>
    Next: <a href="/user-guide/settings-wallet-auth/">Settings, Wallet, Auth</a>
  </p>
</div>
