# Walpurgis Bot v2

Walpurgis Bot v2 is a high-performance, production-grade Discord bot meticulously engineered to **automatically and reliably archive daily media posts from a specific user**. Re-engineered from the ground up on a modern, type-safe foundation with **Bun and TypeScript**, it delivers exceptional reliability, maintainability, and operational excellence.

This bot moves beyond a simple script, serving as a **robust, managed service for critical data archiving**, ensuring no important memories are lost.

---

## 📖 Table of Contents

*   [✨ Core Features](#-core-features)
*   [⚙️ Commands](#️-commands)
*   [🚀 Production Deployment (Docker)](#-production-deployment-docker)
*   [💻 Development Setup](#-development-setup)
*   [🏛️ Architecture & Design Philosophy](#️-architecture--design-philosophy)
*   [🤝 Contributing](#-contributing)
*   [📄 License](#-license)

---

## ✨ Core Features

Walpurgis Bot v2 is built to be a reliable and complete archiving solution:

*   **🤖 Automatic Archiving with Integrity**: A dedicated event handler listens to the target user's messages, intelligently validates content with regex, and automatically archives media with an immediate confirmation reaction (✅).
*   **🛡️ Robust Data Integrity**: Features a sophisticated cooldown system to prevent accidental duplicate archives. Logic for out-of-sequence day numbers intelligently prompts for manual intervention, proactively preventing data corruption and ensuring archive accuracy.
*   **🗄️ Comprehensive Command Suite**: A full set of slash commands provides complete control over your archives:
    *   **`/search`**: Instantly retrieve and display any day's archived media and metadata.
    *   **`/status`**: Generate a paginated, emoji-coded audit report of archived versus missing days, making it easy to spot gaps.
    *   **`/delete`**: Safely remove an archive with a clear confirmation prompt, preventing accidental data loss.
    *   **`/manual-archive`**: A user-friendly modal workflow to effortlessly archive posts that the automatic system might have missed or that require correction.
*   **💾 Persistent & Atomic Storage**: All critical data is securely stored in a local SQLite database, ensured persistent in production via a Docker volume. All database operations are atomic and transactional, guaranteeing data consistency even during unexpected events.
*   **🚀 Blazing Fast Performance**: Leverages the high-speed Bun runtime and an optimized `better-sqlite3` driver for a responsive and fluid user experience.
*   **🏗️ Scalable & Maintainable Design**: Built with a normalized database schema and a modular, decoupled code structure, allowing the bot to easily grow with new features without requiring extensive refactoring.

---

## ⚙️ Commands

The bot is controlled entirely through intuitive Discord slash commands, designed for ease of use and powerful archive management.

### `/search [day]`
Retrieves a specific day's archive, complete with an embed and links.

*   **Description:** Fetches the archived message and media for a given day number.
*   **Parameters:**
    | Parameter | Type    | Required? | Description                          |
    | :-------- | :------ | :-------- | :----------------------------------- |
    | `day`     | Integer | **Yes**   | The day number you want to find (e.g., `150`). |
*   **Example Usage:** `</search day:150>`
*   **Result:** The bot replies with an embed showing the first media attachment, the archive timestamp, and direct links to the original Discord message and any additional media.

### `/status [start] [end]`
Provides a paginated, emoji-coded list showing which days in a range are archived or missing.

*   **Description:** Your powerful tool for auditing the completeness and health of the archive.
*   **Parameters:**
    | Parameter | Type    | Required? | Description                                       |
    | :-------- | :------ | :-------- | :------------------------------------------------ |
    | `start`   | Integer | No        | The first day of the range to check. Defaults to `1`. |
    | `end`     | Integer | No        | The last day of the range. Defaults to the latest day in the archive. |
*   **Example Usage:** `</status start:100 end:150>` or `</status>` for a full audit.
*   **Result:** An ephemeral, paginated embed appears showing `Day 100: ✅`, `Day 101: ❌`, etc., allowing you to easily identify missing archives. Navigation buttons enable seamless browsing through all pages.

### `/delete [day]`
A safe, confirmation-based command to remove an entry from the archive.

*   **Description:** Prevents accidental data loss by requiring explicit confirmation before deleting any archived day.
*   **Parameters:**
    | Parameter | Type    | Required? | Description                                 |
    | :-------- | :------ | :-------- | :------------------------------------------ |
    | `day`     | Integer | **Yes**   | The day number of the archive to delete. |
*   **Example Usage:** `</delete day:150>`
*   **Result:** The bot sends an ephemeral message with "Yes, Delete" and "No, Cancel" buttons. The deletion only proceeds if explicitly confirmed.

### `/manual-archive [message_id]`
A modal-based workflow for archiving a post that the automatic system missed or needs correction.

*   **Description:** Your primary tool for handling edge cases, correcting mistakes, or backfilling missing archives.
*   **Parameters:**
    | Parameter    | Type   | Required? | Description                                 |
    | :----------- | :----- | :-------- | :------------------------------------------ |
    | `message_id` | String | **Yes**   | The Discord Message ID of the post you want to archive. |
*   **Example Usage:** `</manual-archive message_id:112233445566778899>`
*   **Result:** A pop-up modal appears, prompting you to input the `Day Number`. Upon submission, the bot archives the specified message and its media for the given day.

---

## 🚀 Production Deployment (Docker)

Deploying with Docker is the recommended method for production environments. It provides a consistent, isolated, and auto-restarting setup for maximum reliability.

### Prerequisites
*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

### 1. `docker-compose.yml`
Create a `docker-compose.yml` file in your desired deployment directory:

```yaml
version: '3.8'

services:
  walpurgisbot:
    # Build the image from the Dockerfile in the current directory
    build: .
    container_name: walpurgisbot
    # Ensure the bot automatically restarts unless explicitly stopped
    restart: unless-stopped
    # Load sensitive environment variables from a .env file in the same directory
    env_file:
      - .env
    # Mount a local 'data' directory into the container to persist the SQLite database
    volumes:
      - ./data:/usr/src/app/data
```

> **Note:** This `docker-compose.yml` assumes a `Dockerfile` exists in the same directory, which it does within this project structure.

### 2. Environment Configuration (`.env`)
Create a `.env` file in the **same directory** as your `docker-compose.yml` by copying `.env.example`. **Fill in your own values.**

```env
# Set to 'production' for optimal performance, detailed logging, and error handling
NODE_ENV=production

# --- Discord Bot Credentials (Required) ---
# Your bot's secret token from the Discord Developer Portal (https://discord.com/developers/applications)
TOKEN=your_discord_bot_token_here
# Your bot's application ID (also from the Discord Developer Portal)
CLIENT_ID=your_bot_client_id_here

# --- Application Settings (Required) ---
# The ID of the Discord server (guild) where you want the bot to operate.
# Commands will be registered specifically for this guild.
GUILD_ID=your_target_server_id_here
# The Discord User ID of the specific user whose posts you intend to archive.
JOHAN_USER_ID=the_user_id_to_track_here
```

### 3. Deployment Steps
1.  **Create a data directory:** This local folder will store the SQLite database file, ensuring your archive data persists even if the container is removed or recreated.
    ```bash
    mkdir data
    ```
2.  **Build and run the container:** This command will build the Docker image (if not already built) and start the Walpurgis Bot in the background.
    ```bash
    docker-compose up --build -d
    ```

### Managing the Bot
*   **View real-time logs:** `docker-compose logs -f walpurgisbot`
*   **Stop the bot:** `docker-compose stop walpurgisbot`
*   **Restart the bot:** `docker-compose restart walpurgisbot`
*   **Take down the container and network (preserves data volume):** `docker-compose down`
*   **Take down the container and remove the data volume:** `docker-compose down -v` (Use with caution!)

---

## 💻 Development Setup

For those who wish to contribute or run the bot locally without Docker for faster iteration.

### Prerequisites
*   [Bun](https://bun.sh/docs/installation) (Runtime, Package Manager, Test Runner)

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
3.  **Configure environment:** Create a `.env` file by copying `.env.example`. For development, the `GUILD_ID` is **essential** as slash commands are registered per-guild for instant updates, allowing for rapid testing without global propagation delays.
4.  **Deploy slash commands:** Before the first run (and anytime you change a command's definition), you must register them with Discord.
    ```bash
    bun run deploy:commands
    ```
5.  **Start the bot:** Run the bot in development mode, typically with hot-reloading enabled by Bun.
    ```bash
    bun run dev
    ```
6.  **Run tests:**
    ```bash
    bun test
    ```

---

## 🏛️ Architecture & Design Philosophy

This project is meticulously guided by four fundamental principles, ensuring a robust, maintainable, and high-performance archiving solution. Every architectural decision stems from these core tenets:

1.  **Unyielding Reliability**: The bot's primary function—archiving critical data—demands absolute reliability. This is achieved through:
    *   **Transactional Database Operations**: Ensuring all-or-nothing data writes, preventing partial or corrupted entries.
    *   **Runtime Data Validation**: Employing **Zod** for strict schema validation of all incoming and outgoing data, catching errors early.
    *   **Structured Logging**: Utilizing **Pino** for comprehensive, context-rich logging, crucial for debugging and operational monitoring.

2.  **Developer-First Maintainability**: A clean, understandable codebase is paramount for long-term sustainability and collaborative development. This is fostered by:
    *   **Strict TypeScript Type Safety**: Eliminating entire classes of bugs at compile time and providing excellent autocompletion.
    *   **Dependency Injection (DI)**: Decoupling components for easier testing, mocking, and isolated development.
    *   **Logical Project Structure**: A clear directory and file organization that naturally guides developers to relevant code.

3.  **Engineered for Scalability**: The architecture is designed to gracefully handle growth, from a single user to many, and from simple features to complex ones. This is enabled by:
    *   **Normalized Database Schema**: Efficiently handles varying numbers of media attachments per post without requiring schema changes or performance degradation.
    *   **Modular Handlers**: New features can be added cleanly as isolated modules, minimizing side effects and complexity.

4.  **Extreme Performance**: Delivering a fast and responsive user experience is a core objective. This is achieved by:
    *   **Bun Runtime**: Leveraging Bun's unparalleled speed for execution and I/O operations.
    *   **High-Performance Database Driver**: Utilizing `better-sqlite3` for native-level SQLite interactions, ensuring minimal overhead.
    *   **Optimized Multi-Stage Docker Images**: Creating lean, efficient production containers that start quickly and consume fewer resources.

### Project Structure
The project is organized with a strict separation of concerns, making navigation and understanding intuitive:
```
src/
├── commands/           # Each file defines a Discord slash command and its execution logic.
├── database/           # Contains the SQLite database connection, schema, and repository for data access.
├── events/             # Each file handles a specific Discord client event (e.g., messageCreate, interactionCreate).
├── lib/                # Reusable utility functions and handlers (e.g., command deployment, common logic).
├── types/              # TypeScript type definitions and Zod schemas for data validation.
├── config.ts           # Centralized environment variable loading and validation.
├── index.ts            # The application's entry point, handling Discord client initialization and dependency injection.
└── logger.ts           # Pino logger configuration for consistent logging across the application.
```

---

## 🤝 Contributing
Contributions are welcome! Please feel free to open issues, submit pull requests, or suggest improvements. Refer to the [Development Setup](#-development-setup) section for getting started.

---

## 📄 License
This project is licensed under the MIT License.