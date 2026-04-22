# Repetly Deployment

## Production requirements

- Public HTTPS domain
- Node.js 18+ recommended
- Persistent storage for `data/repetly.sqlite`
- Outbound access to Telegram API

## Production env

Use `.env.example` as the base for production.

Required values:

```env
PORT=3001
CLIENT_URL=https://your-domain.com
API_BASE_URL=https://your-domain.com
SESSION_SECRET=replace-with-long-random-secret
SESSION_COOKIE_SECURE=true

TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=replace-with-long-random-secret
TELEGRAM_AUTH_MODE=widget
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/integrations/telegram/webhook
TELEGRAM_POLLING_ENABLED=false
TELEGRAM_LINK_TTL_MINUTES=15
TELEGRAM_REMINDER_OFFSETS_MINUTES=1440,60,15
```

Notes:

- `CLIENT_URL` and `API_BASE_URL` should normally be the same public HTTPS origin.
- `SESSION_COOKIE_SECURE=true` is required for normal production cookies over HTTPS.
- `TELEGRAM_AUTH_MODE=widget` enables the standard Telegram web auth flow.
- `TELEGRAM_POLLING_ENABLED=false` means the bot should work through webhook mode in production.

## Local env

For local development use `.env.local.example` as the base.

Local mode uses:

- `TELEGRAM_AUTH_MODE=local`
- `TELEGRAM_POLLING_ENABLED=true`
- `SESSION_COOKIE_SECURE=false`

## Deploy steps

1. Install dependencies:

```bash
npm install
```

2. Build frontend:

```bash
npm run build
```

3. Start backend:

```bash
npm start
```

4. Open the public domain and verify:

- sign in / sign up
- password auth
- Telegram auth widget
- Telegram bot commands
- Telegram linking in settings
- Telegram notifications and reminders

## Telegram checklist

Before production launch make sure:

- the bot token is valid
- the public domain is reachable over HTTPS
- `TELEGRAM_WEBHOOK_URL` points to `/api/integrations/telegram/webhook`
- the bot can reach Telegram API from the server
- the server can receive POST requests from Telegram

## Data and logs

Persist these directories between deploys:

- `data`
- `logs` (optional but recommended)
