Of course! This is an exceptionally well-written and detailed README. The core content is fantastic. I've fixed the formatting issues, primarily in the Table of Contents links and the broken permissions table, to ensure it renders perfectly on platforms like GitHub.

Here is the revised and cleaned-up version of your README.

***

# Walpurgis Bot v2

Walpurgis Bot v2 is a high‑performance, production‑grade Discord bot meticulously engineered to **automatically and reliably archive daily media posts from a specific user**. Re‑engineered from the ground up on a modern, type‑safe foundation with **Bun and TypeScript**, it delivers exceptional reliability, maintainability, and operational excellence.

This bot moves beyond a simple script, serving as a **robust, stateful service for critical data archiving**, ensuring no important memories are lost.

---

## 📖 Table of Contents

* [✨ Core Features](#-core-features)
* [🧠 How Automatic Archiving Works](#-how-automatic-archiving-works)
* [⚙️ Commands & Admin Tools](#️-commands--admin-tools)
* [🚀 Production Deployment (Docker)](#-production-deployment-docker)
  * [🛂 Host-Volume Permissions (Unraid & Co.)](#-host-volume-permissions-unraid--co)
* [💻 Development Setup](#-development-setup)
* [🏛️ Architecture & Design Philosophy](#️-architecture--design-philosophy)
* [🤝 Contributing](#-contributing)
* [📄 License](#-license)

---

## ✨ Core Features

Walpurgis Bot v2 is built to be a reliable and complete archiving solution:

*   **🧠 Intelligent & Contextual Archiving**: The bot uses a stateful, session‑based system to understand human posting patterns. It can correctly associate media and text even when they are posted in separate messages, providing a seamless user experience.
*   **🛡️ Absolute Data Integrity**: Instead of a simple cooldown, the bot uses precise, state‑based validation against the database to prevent duplicates. Logic for out‑of‑sequence or ambiguous posts intelligently prompts for manual intervention, proactively preventing data corruption.
*   **🗄️ Comprehensive Command Suite**: A full set of slash commands provides complete control over your archives, from searching and auditing to safe deletion and easy manual entry via user‑friendly modals.
*   **💾 Persistent & Atomic Storage**: All data is securely stored in a local SQLite database, with persistence ensured in production via a Docker volume. All database write operations are **atomic and transactional**, guaranteeing data consistency even during unexpected events.
*   **🚀 Blazing Fast Performance**: Leverages the high‑speed Bun runtime and an optimized `better-sqlite3` driver for a responsive and fluid user experience.
*   **🏗️ Scalable & Maintainable Design**: Built with a normalized database schema and a modular, decoupled code structure, allowing the bot to easily grow with new features without requiring extensive refactoring.

---

## 🧠 How Automatic Archiving Works

The bot's intelligence comes from its stateful, session‑based design that mimics how a human would interpret posts. It does **not** make instant, stateless decisions.

1.  **Session Initiation**: A short‑lived (5‑minute) **"Pending Post Session"** is created *only* when the target user posts a message containing **media** (images or videos).
2.  **Context Gathering**: The bot understands that text and media aren't always in the same message.
    *   **Media First, Text Second**: If the user posts a photo, then a separate comment like "Day 101" a minute later, the bot adds the text to the existing session, completing it for evaluation.
    *   **Text First, Media Second**: If the user posts "Day 101" and then uploads a photo, the bot creates a session for the media, then automatically performs a "look‑behind" search of recent messages. It finds the preceding text and combines it with the media to form a complete session.
3.  **Content Parsing & Confidence Scoring**: The bot parses message content for day numbers with varying levels of confidence:
    *   **High Confidence**: The message contains keywords like `day`, `daily`, or `johan` next to a number (e.g., "Daily Johan 101").
    *   **Low Confidence**: The message contains a number but no keywords (e.g., "yearly bobot 111").
4.  **Automated Evaluation & Action**: Once a session is complete, it's evaluated against a strict set of rules:
    *   ✅ **Happy Path**: A high‑confidence, in‑sequence day is found. The post is archived, and the original message is reacted with `✅`.
    *   ⚠️ **Benign Duplicate**: The day is already in the database. The archive is aborted, and the message is reacted with `⚠️` to signal it was seen but ignored.
    *   🤔 **Low Confidence / Typo**: The bot finds a number but isn't sure. It sends a private prompt to an administrator with `[Confirm Archive]` and `[Ignore]` buttons.
    *   ⁉️ **Out‑of‑Sequence**: The bot expects Day `109` but sees Day `110`. It assumes a human error and prompts an admin with `[Force Archive]` and `[Ignore]` buttons.
    *   ❌ **Ambiguous Post**: The message contains multiple day numbers ("Day 107 and 108"). The bot aborts to prevent data corruption and notifies an admin to use the manual archive command.
    *   ❓ **Forgotten Text**: The user posts only media and no text follows within 15 seconds. The bot proactively asks an admin if the post should be archived, providing an option to add the day number directly.

This entire process ensures the bot is both highly automated and extremely safe, escalating any ambiguity to a human operator.

---

## ⚙️ Commands & Admin Tools

The bot is controlled through intuitive slash commands and context menus for admins.

### Public Commands

#### `/search <day>`

Retrieves a specific day's archive, complete with an embed and links.

*   **Example Usage:** `</search day:150>`
*   **Result:** The bot replies with an embed showing the first media attachment, the archive timestamp, and direct links to the original Discord message and any additional media.

#### `/status [start] [end]`

Provides a paginated, emoji‑coded list showing which days in a range are archived or missing. By default, it shows a window of 20 days.

*   **Example Usage:** `</status start:100 end:150>` or `</status start:100` for a 20‑day audit from 100.
*   **Result:** An ephemeral, paginated embed appears showing `Day 100: ✅`, `Day 101: ❌`, etc., allowing you to easily identify missing archives.

### Admin‑Only Tools

These require the configured `ADMIN_ROLE_ID`.

#### `/delete <day|link>`

A safe, confirmation‑based command to remove an entry from the archive.

*   **By Day:** `/delete day:150`
*   **By Message Link:** `/delete link:https://discord.com/.../12345`

#### `/manual-archive <message_id>`

A modal‑based workflow for archiving a post that the automatic system missed.

#### `/settings <channel|timezone|reminder>`

Configures the bot's behavior for scheduled reminders and notifications.

#### `/import` & `/export`

Bulk import/export of the entire archive.

#### Right‑Click Context Menus

*   `Manual Archive Post`
*   `Delete Archive Entry`

---

## 🚀 Production Deployment (Docker)

Deploying with Docker is the recommended method for production. It provides a consistent, isolated, and auto‑restarting setup for maximum reliability.

### Prerequisites

*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### 1. `docker-compose.yml`

This project includes pre‑configured compose files (`docker-compose.production.yml`, `docker-compose.unraid.yml`, etc.). Pick the one closest to your host environment.

### 2. Environment Configuration (`.env`)

Create a `.env` file by copying `.env.example` and fill in your values.

```env
NODE_ENV=production
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_target_server_id_here
JOHAN_USER_ID=the_user_id_to_track_here
ADMIN_ROLE_ID=admin_role_id_here
DATABASE_PATH=/app/data/walpurgis.db
```

### 3. Deployment Steps

```bash
# Build (if needed) and start the container stack in the background
docker compose -f docker-compose.unraid.yml up -d --build
```

### 🛂 Host-Volume Permissions (Unraid & Co.)

If you are **bind‑mounting a host folder** (e.g., `/mnt/user/appdata/walpurgisbot-v2` on Unraid), you must ensure the directory is **writable by the container’s non‑root user**. Otherwise, SQLite will throw an `SQLITE_CANTOPEN` error on startup.

**Why this happens:**
1.  The Docker image creates and uses a non-root `appuser` (UID `100` / GID `101`).
2.  When Docker first creates the host folder for the volume, it is owned by `root:root`.
3.  The `appuser` inside the container cannot write to the `root`-owned folder, causing the crash.

#### 🔧 Fix Options

| Option | How to Fix | Notes |
| :--- | :--- | :--- |
| **A. Chown host folder (Recommended)** | On the host machine, set the correct owner and permissions:<br><code>mkdir -p /mnt/user/appdata/walpurgisbot-v2</code><br><code>chown -R 100:101 /mnt/user/appdata/walpurgisbot-v2</code><br><code>chmod -R 770 /mnt/user/appdata/walpurgisbot-v2</code> | One-time setup. This is the most robust and secure method as it aligns host permissions with the container's user. |
| **B. Force container's user** | In your `docker-compose.yml`, tell the service to run as a specific user:<br><code>user: "100:101"</code> | Simple fix. Keeps configuration within the compose file. The UID/GID must match the one inside the image. |
| **C. Use a named volume** | Use a Docker-managed named volume instead of a bind-mount in your `docker-compose.yml`. | Docker handles permissions automatically. The data is stored in Docker's internal area (`/var/lib/docker/volumes`), not your `appdata` share. |
| **D. Run as root (Not Advised)** | Force the container to run as root:<br><code>user: "0:0"</code> | Works, but forfeits the security benefit of running as a non-root user. Avoid in production. |

After applying a fix, restart the stack to apply the changes:

```bash
docker compose -f docker-compose.unraid.yml down
docker compose -f docker-compose.unraid.yml up -d
```

You should now see log lines confirming a successful start:
```log
{"level":30,"time":1752344157511,...,"msg":"Database connected at /app/data/walpurgis.db"}
{"level":30,"time":1752344157512,...,"msg":"Running migration: 000_initial_schema.sql..."}
{"level":30,"time":1752344158000,...,"msg":"Ready! Logged in as WalpurgisBot#5614"}
```

---

## 💻 Development Setup

> **Tip**: Development mode stores the SQLite database in the project folder (`./data`). No special permissions are required.

### Prerequisites

*   [Bun](https://bun.sh/docs/installation)

### Steps

```bash
# Clone the repository
git clone https://github.com/your-username/walpurgisbot-v2.git
cd walpurgisbot-v2

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# ...then edit .env with your tokens and IDs

# Deploy slash commands to your test guild
bun run src/lib/deploy-commands.ts

# Start the bot in development mode
bun run src/index.ts
```

---

## 🏛️ Architecture & Design Philosophy

<details>
<summary>Click to expand</summary>

### 1. Unyielding Reliability
*   Transactional database operations, runtime data validation with **Zod**, and structured, machine-readable logging via **Pino**.

### 2. Developer‑First Maintainability
*   Strict TypeScript, a dependency-injection-like service container, and a logical project structure make the codebase easy to navigate and extend.

### 3. Engineered for Scalability
*   A normalized database schema and modular command, event, and service layers allow the bot to grow with new features without requiring extensive refactoring.

### 4. Extreme Performance
*   Built on the Bun runtime and the native `bun:sqlite` driver for maximum speed and efficiency.

</details>

---

## 🤝 Contributing

Pull requests and issues are welcome! See **[Development Setup](#-development-setup)** above to get started quickly.

---

## 📄 License

This project is licensed under the BSD-3-Clause License.