#!/usr/bin/env bash
#
# One-command local setup for school-backend contributors.
#
# What this does, in order:
#   1. Checks Node.js and mongod are installed.
#   2. Installs npm dependencies.
#   3. Creates .env from .env.example on first run, with real random
#      secrets in place of the placeholders (never reused between
#      contributors, never committed — .env is gitignored).
#   4. Starts a small, project-local MongoDB replica set dedicated to
#      this repo (scripts/start-dev-mongo.js) — separate from any other
#      MongoDB on your machine, on its own port, safe to leave running.
#      A replica set specifically because school creation uses a real
#      multi-document transaction, which a standalone mongod rejects.
#   5. Generates a disposable, self-signed Firebase dev key if you don't
#      already have real Firebase credentials configured
#      (scripts/generate-dev-firebase-key.js) — login and the core app
#      work without a real Firebase project; only Firestore-backed chat
#      and push notifications need real credentials.
#   6. Seeds fictional demo data (scripts/seed-demo-data.js): one demo
#      school with a handful of staff and students, plus a platform
#      super-admin account — prints both logins at the end.
#   7. Starts the API server in the foreground (Ctrl+C to stop).
#
# Safe to re-run at any time — every step here is idempotent.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

log "Checking prerequisites"

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 22.x from https://nodejs.org and re-run this script."
NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
	echo "Warning: this project targets Node.js 22.x; you have $(node -v). It may still work, but 22.x is what's tested."
fi

command -v mongod >/dev/null 2>&1 || fail "mongod is not installed. Install MongoDB Community Server (https://www.mongodb.com/docs/manual/administration/install-community/) and re-run this script."

log "Installing npm dependencies"
npm install

log "Setting up environment variables"
if [ -f .env ]; then
	echo ".env already exists — leaving it as-is. Delete it and re-run this script if you want a fresh one."
else
	cp .env.example .env
	# Real random secrets per contributor, never shared, never committed.
	for VAR in JWT_SECRET JWT_SECRET_STUDENT JWT_SECRET_PLATFORM JWT_SECRET_PERSON STELLAR_KEY_ENCRYPTION_SECRET; do
		SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
		# macOS/BSD sed needs -i '' ; GNU sed needs -i with no argument.
		if sed --version >/dev/null 2>&1; then
			sed -i "s#^${VAR}=.*#${VAR}=${SECRET}#" .env
		else
			sed -i '' "s#^${VAR}=.*#${VAR}=${SECRET}#" .env
		fi
	done
	echo "Created .env with fresh random secrets."
fi

log "Starting the local MongoDB replica set (project-local, port 27018)"
npm run db:dev

log "Setting up a disposable Firebase dev key (skipped if you already have real credentials)"
npm run seed:dev-firebase-key

log "Seeding fictional demo data"
npm run seed:demo-data

log "Setup complete. Starting the API server on http://localhost:8000 (Ctrl+C to stop)"
npm run start:dev
