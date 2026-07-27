import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now } from "../clock.js";

const composer = new Composer<Ctx>();
registerMainMenuItem({ label: "Create a summary", data: "teacher:tools", order: 30 });

function summary(topic: string): string {
  return `Study summary: ${topic}\n\nKey idea\nDefine the topic in one precise sentence.\n\nTeaching sequence\n1. Introduce the vocabulary.\n2. Model one example.\n3. Ask students to explain the reasoning.\n\nReview\nUse one short practice task and discuss the answer.`;
}

async function makeSummary(ctx: Ctx, topic: string, edit = false): Promise<void> {
  const clean = topic.trim();
  if (clean.length < 3 || clean.length > 120) {
    const text = "Use a topic between 3 and 120 characters.";
    if (edit) await ctx.editMessageText(text); else await ctx.reply(text);
    return;
  }
  const text = summary(clean);
  await ctx.studyStore.put(`summary:${clean.toLowerCase()}`, { topic: clean, explanation: text });
  ctx.session.step = undefined;
  ctx.session.expiresAt = undefined;
  const keyboard = inlineKeyboard([[inlineButton("Copy for printing", "teacher:copy")], [inlineButton("Back to menu", "menu:main")]]);
  if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }); else await ctx.reply(text, { reply_markup: keyboard });
}

async function promptTopic(ctx: Ctx, edit = false): Promise<void> {
  ctx.session.step = "awaiting_summary";
  ctx.session.expiresAt = now().getTime() + 5 * 60 * 1000;
  const text = "Send the topic for your printable study summary.";
  const options = { reply_markup: { force_reply: true as const, input_field_placeholder: "Type a study topic…" } };
  // A ForceReply prompt must be a new message rather than an edit.
  await ctx.reply(text, options);
}

composer.command("summary", async (ctx) => {
  if (!ctx.session.teacher) { await ctx.reply("Teacher tools need a teacher profile. Open Teacher tools to confirm your role."); return; }
  const topic = ctx.match.trim();
  if (topic) await makeSummary(ctx, topic); else await promptTopic(ctx);
});
composer.callbackQuery("teacher:tools", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (ctx.session.teacher) { await promptTopic(ctx, true); return; }
  await ctx.editMessageText("Teacher tools are for teachers and tutors. Confirm your role to create printable summaries.", { reply_markup: inlineKeyboard([[inlineButton("Confirm teacher role", "teacher:confirm")], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery("teacher:confirm", async (ctx) => { ctx.session.teacher = true; await ctx.answerCallbackQuery(); await promptTopic(ctx, true); });
composer.callbackQuery("teacher:copy", async (ctx) => { await ctx.answerCallbackQuery({ text: "Select and copy this summary to print it." }); });
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_summary") return next();
  if ((ctx.session.expiresAt ?? 0) < now().getTime()) {
    ctx.session.step = undefined;
    ctx.session.expiresAt = undefined;
    await ctx.reply("That summary request expired. Tap Create a summary to start again.");
    return;
  }
  await makeSummary(ctx, ctx.message.text);
});

export default composer;
