# Walpurgis Bot v2

Walpurgis Bot v2 is a high-performance, production-grade Discord bot meticulously engineered to **automatically and reliably archive daily media posts from a specific user**. Re-engineered from the ground up on a modern, type-safe foundation with **Bun and TypeScript**, it delivers exceptional reliability, maintainability, and operational excellence.

This bot moves beyond a simple script, serving as a **robust, stateful service for critical data archiving**, ensuring no important memories are lost.

---

## 📖 Table of Contents

*   [✨ Core Features](#-core-features)
*   [🧠 How Automatic Archiving Works](#-how-automatic-archiving-works)
*   [⚙️ Commands & Admin Tools](#️-commands--admin-tools)
*   [🚀 Production Deployment (Docker)](#-production-deployment-docker)
*   [💻 Development Setup](#-development-setup)
*   [🏛️ Architecture & Design Philosophy](#️-architecture--design-philosophy)
*   [🤝 Contributing](#-contributing)
*   [📄 License](#-license)

---

## ✨ Core Features

Walpurgis Bot v2 is built to be a reliable and complete archiving solution:

*   **🧠 Intelligent & Contextual Archiving**: The bot uses a stateful, session-based system to understand human posting patterns. It can correctly associate media and text even when they are posted in separate messages, providing a seamless user experience.
*   **🛡️ Absolute Data Integrity**: Instead of a simple cooldown, the bot uses precise, state-based validation against the database to prevent duplicates. Logic for out-of-sequence or ambiguous posts intelligently prompts for manual intervention, proactively preventing data corruption.
*   **🗄️ Comprehensive Command Suite**: A full set of slash commands provides complete control over your archives, from searching and auditing to safe deletion and easy manual entry via user-friendly modals.
*   **💾 Persistent & Atomic Storage**: All data is securely stored in a local SQLite database, with persistence ensured in production via a Docker volume. All database write operations are **atomic and transactional**, guaranteeing data consistency even during unexpected events.
*   **🚀 Blazing Fast Performance**: Leverages the high-speed Bun runtime and an optimized `better-sqlite3` driver for a responsive and fluid user experience.
*   **🏗️ Scalable & Maintainable Design**: Built with a normalized database schema and a modular, decoupled code structure, allowing the bot to easily grow with new features without requiring extensive refactoring.

---

## 🧠 How Automatic Archiving Works

The bot's intelligence comes from its stateful, session-based design that mimics how a human would interpret posts. It does **not** make instant, stateless decisions.

1.  **Session Initiation**: A short-lived (5-minute) **"Pending Post Session"** is created *only* when the target user posts a message containing **media** (images or videos).

2.  **Context Gathering**: The bot understands that text and media aren't always in the same message.
    *   **Media First, Text Second**: If the user posts a photo, then a separate comment like "Day 101" a minute later, the bot adds the text to the existing session, completing it for evaluation.
    *   **Text First, Media Second**: If the user posts "Day 101" and then uploads a photo, the bot creates a session for the media, then automatically performs a "look-behind" search of recent messages. It finds the preceding text and combines it with the media to form a complete session.

3.  **Content Parsing & Confidence Scoring**: The bot parses message content for day numbers with varying levels of confidence:
    *   **High Confidence**: The message contains keywords like `day`, `daily`, or `johan` next to a number (e.g., "Daily Johan 101").
    *   **Low Confidence**: The message contains a number but no keywords (e.g., "yearly bobot 111").

4.  **Automated Evaluation & Action**: Once a session is complete, it's evaluated against a strict set of rules:
    *   ✅ **Happy Path**: A high-confidence, in-sequence day is found. The post is archived, and the original message is reacted with `✅`.
    *   ⚠️ **Benign Duplicate**: The day is already in the database. The archive is aborted, and the message is reacted with `⚠️` to signal it was seen but ignored.
    *   🤔 **Low Confidence / Typo**: The bot finds a number but isn't sure. It sends a private prompt to an administrator with `[Confirm Archive]` and `[Ignore]` buttons.
    *   ⁉️ **Out-of-Sequence**: The bot expects Day `109` but sees Day `110`. It assumes a human error and prompts an admin with `[Force Archive]` and `[Ignore]` buttons.
    *   ❌ **Ambiguous Post**: The message contains multiple day numbers ("Day 107 and 108"). The bot aborts to prevent data corruption and notifies an admin to use the manual archive command.
    *   ❓ **Forgotten Text**: The user posts only media and no text follows within 15 seconds. The bot proactively asks an admin if the post should be archived, providing an option to add the day number directly.

This entire process ensures the bot is both highly automated and extremely safe, escalating any ambiguity to a human operator.

---

## ⚙️ Commands & Admin Tools

The bot is controlled through intuitive slash commands and context menus for admins.

### Public Commands
These are available to all users.

#### `/search <day>`
Retrieves a specific day's archive, complete with an embed and links.
*   **Example Usage:** `</search day:150>`
*   **Result:** The bot replies with an embed showing the first media attachment, the archive timestamp, and direct links to the original Discord message and any additional media.

#### `/status [start] [end]`
Provides a paginated, emoji-coded list showing which days in a range are archived or missing. By default, it shows a window of 20 days.
*   **Example Usage:** `</status start:100 end:150>` or `</status start:100` for a 20-day audit from 100.
*   **Result:** An ephemeral, paginated embed appears showing `Day 100: ✅`, `Day 101: ❌`, etc., allowing you to easily identify missing archives.

### Admin-Only Tools
These require the configured `ADMIN_ROLE_ID`.

#### `/delete <day|link>`
A safe, confirmation-based command to remove an entry from the archive. It supports two methods:
*   **By Day:** `/delete day:150`
*   **By Message Link:** `/delete link:https://discord.com/.../12345`
*   **Result:** The bot sends an ephemeral message with "Yes, Delete" and "No, Cancel" buttons. The deletion only proceeds if explicitly confirmed.

#### `/manual-archive <message_id>`
A modal-based workflow for archiving a post that the automatic system missed.
*   **Example Usage:** `</manual-archive message_id:112233445566778899>`
*   **Result:** A pop-up modal appears, pre-filling the day number if it can be parsed, and prompting you for confirmation. Upon submission, the bot archives the message.

#### `/settings <channel|timezone|reminder>`
Configures the bot's behavior for scheduled reminders and notifications. Allows setting the notification channel, server timezone, and enabling/disabling daily reminders.

#### `/import` & `/export`
Provides bulk data management by importing or exporting the entire archive to a JSON file.

#### Right-Click Context Menus
For ultimate convenience, admins can simply **right-click a message** and select:
*   **`Manual Archive Post`**: Opens the same modal as the slash command.
*   **`Delete Archive Entry`**: Initiates the safe deletion workflow for that message.

---

## 🚀 Production Deployment (Docker)

Deploying with Docker is the recommended method for production. It provides a consistent, isolated, and auto-restarting setup for maximum reliability.

### Prerequisites
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### 1. `docker-compose.yml`
This project includes a pre-configured `docker-compose.yml` file designed for production use.

### 2. Environment Configuration (`.env`)
Create a `.env` file by copying `.env.example`. **Fill in your own values.**

```env
# Set to 'production' for optimal performance and logging
NODE_ENV=production

# --- Discord Bot Credentials (Required) ---
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_target_server_id_here

# --- Application Logic (Required) ---
JOHAN_USER_ID=the_user_id_to_track_here
ADMIN_ROLE_ID=a_role_id_for_users_who_can_manage_the_bot

# --- Database (Required) ---
# For Docker, this path points *inside* the container to the mounted volume
DATABASE_PATH=walpurgis.db

# --- Proactive Features (Optional, but Recommended) ---
# The channel ID where the bot sends reminders/prompts before one is set via /settings
# DEFAULT_CHANNEL_ID=your_default_notification_channel_id
# The IANA timezone (e.g., "America/New_York") for scheduling before one is set
# TIMEZONE=UTC
```

### 3. Deployment Steps
1.  **Build and run the container:** This command will build the Docker image and start the bot in the background. It also ensures the database volume is created and mounted.
    ```bash
    docker-compose up --build -d
    ```

### Managing the Bot
*   **View real-time logs:** `docker-compose logs -f`
*   **Stop the bot:** `docker-compose stop`
*   **Restart the bot:** `docker-compose restart`
*   **Take down the container and network:** `docker-compose down`

---

## 💻 Development Setup

For those who wish to contribute or run the bot locally without Docker.

### Prerequisites
*   [Bun](https://bun.sh/docs/installation)

### Steps
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/walpurgisbot-v2.git
    cd walpurgisbot-v2
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Configure environment:** Create a `.env` file by copying `.env.example`. The `GUILD_ID` is essential for development, as it allows for instant command updates to a single test server.
4.  **Deploy slash commands:** Before the first run (and anytime you change a command's definition), you must register them with Discord.
    ```bash
    bun run src/lib/deploy-commands.ts
    ```
5.  **Start the bot:**
    ```bash
    bun run src/index.ts
    ```

---

## 🏛️ Architecture & Design Philosophy

This project is meticulously guided by four fundamental principles, ensuring a robust, maintainable, and high-performance archiving solution.

1.  **Unyielding Reliability**: The bot's primary function—archiving critical data—demands absolute reliability. This is achieved through:
    *   **Transactional Database Operations**: Ensuring all-or-nothing data writes with `better-sqlite3`, preventing partial or corrupted entries.
    *   **Runtime Data Validation**: Employing **Zod** for strict schema validation of all incoming and outgoing data, catching errors early.
    *   **Structured Logging**: Utilizing **Pino** for comprehensive, context-rich logging, crucial for debugging and operational monitoring.
    *   **Robust State Management**: The `ArchiveSessionManager` and `NotificationService` are designed to survive bot restarts and handle missed events.

2.  **Developer-First Maintainability**: A clean, understandable codebase is paramount for long-term sustainability and collaborative development. This is fostered by:
    *   **Strict TypeScript Type Safety**: Eliminating entire classes of bugs at compile time and providing excellent autocompletion.
    *   **Dependency Injection (DI)**: Decoupling components like database repositories and stateful services for easier testing, mocking, and isolated development.
    *   **Logical Project Structure**: A clear directory and file organization that naturally guides developers to relevant code.

3.  **Engineered for Scalability**: The architecture is designed to gracefully handle growth. This is enabled by:
    *   **Normalized Database Schema**: Efficiently handles varying numbers of media attachments per post without requiring schema changes.
    *   **Modular Handlers**: New features can be added cleanly as isolated command, event, or service modules, minimizing side effects and complexity.

4.  **Extreme Performance**: Delivering a fast and responsive user experience is a core objective. This is achieved by:
    *   **Bun Runtime**: Leveraging Bun's unparalleled speed for execution and I/O operations.
    *   **High-Performance Database Driver**: Utilizing `better-sqlite3`'s prepared statements and synchronous API for native-level SQLite interactions, ensuring minimal overhead.
    *   **Efficient I/O**: Using Node.js streams for large file operations like `/export` to minimize memory consumption.

### Project Structure
The project is organized with a strict separation of concerns, making navigation and understanding intuitive:
```
src/
├── commands/           # Each file defines a Discord slash command and its execution logic.
├── database/           # Contains the SQLite connection, migrations, and repositories for data access.
├── events/             # Each file handles a specific Discord client event (e.g., messageCreate).
├── lib/                # Reusable utility functions and helpers (e.g., command deployment).
├── services/           # Core stateful services (e.g., ArchiveSessionManager, NotificationService).
├── types/              # TypeScript type definitions and Zod schemas for data validation.
├── config.ts           # Centralized environment variable loading and validation.
├── index.ts            # The application's entry point, handling client initialization and DI.
└── logger.ts           # Pino logger configuration.
```

---

## 🤝 Contributing
Contributions are welcome! Please feel free to open issues, submit pull requests, or suggest improvements. Refer to the [Development Setup](#-development-setup) section for getting started.

---

## 📄 License
This project is licensed under the BSD-3 License.