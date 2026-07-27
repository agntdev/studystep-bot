import { buildBot, type Session } from "./bot.js";
import { setDefaultCommands } from "./toolkit/index.js";
import type { BotContext } from "./toolkit/index.js";
import type { Bot } from "grammy";

async function main() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN is required");
    process.exit(1);
  }
  const bot = await buildBot(token);
  // Publish the "/" command list to Telegram (discoverability). A button-first
  // bot exposes only /start + /help; everything else is reached via menu buttons.
  await setDefaultCommands(bot as unknown as Bot<BotContext<Session>>);
  bot.start();
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
