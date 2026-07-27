import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now, setClock } from "../clock.js";

type Subject = "Math" | "Physics" | "English" | "Biology" | "Chemistry" | "History" | "Computer science" | "Other";

const composer = new Composer<Ctx>();
registerMainMenuItem({ label: "Ask a question", data: "study:ask", order: 10 });
registerMainMenuItem({ label: "Generate practice", data: "study:practice", order: 20 });

const subjects: Subject[] = ["Math", "Physics", "English", "Biology", "Chemistry", "History", "Computer science", "Other"];
const subjectKeyboard = inlineKeyboard([
  [inlineButton("Math", "subject:Math"), inlineButton("Physics", "subject:Physics")],
  [inlineButton("English", "subject:English"), inlineButton("Biology", "subject:Biology")],
  [inlineButton("Chemistry", "subject:Chemistry"), inlineButton("History", "subject:History")],
  [inlineButton("Computer science", "subject:Computer science"), inlineButton("Other", "subject:Other")],
  [inlineButton("Use Math", "subject:Math")],
]);

function cleanQuestion(input: string): string | undefined {
  const question = input.trim();
  return question.length >= 3 && question.length <= 1000 ? question : undefined;
}

function inferSubject(question: string): Subject | undefined {
  const text = question.toLowerCase();
  const matches: Array<[Subject, RegExp]> = [
    ["Physics", /\b(force|velocity|energy|circuit|acceleration)\b/],
    ["Chemistry", /\b(atom|molecule|reaction|acid|element)\b/],
    ["Biology", /\b(cell|genetic|organism|photosynthesis|ecosystem)\b/],
    ["History", /\b(war|empire|revolution|century|treaty)\b/],
    ["English", /\b(essay|grammar|metaphor|paragraph|novel)\b/],
    ["Computer science", /\b(code|algorithm|function|program|database)\b/],
  ];
  return matches.find(([, pattern]) => pattern.test(text))?.[0];
}

function arithmeticAnswer(question: string): string | undefined {
  const expression = question.replace(/\s/g, "").replace(/^what is/i, "");
  if (!/^[0-9+\-*/().]+$/.test(expression) || !/[0-9]/.test(expression)) return undefined;
  // The character whitelist permits only arithmetic tokens before evaluation.
  try {
    const value = Function(`"use strict"; return (${expression})`)() as unknown;
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return String(value);
  } catch {
    return undefined;
  }
}

function solutionText(question: string, subject: Subject): string {
  const answer = subject === "Math" ? arithmeticAnswer(question) : undefined;
  if (answer) {
    return `Solution\n1. Write the expression: ${question.trim()}\n2. Apply the operations in order.\nFinal answer: ${answer}`;
  }
  const focus = subject === "Other" ? "the key terms and the rule or source that applies" : `the central ${subject.toLowerCase()} idea`;
  return `Study plan\n1. Identify ${focus}.\n2. Break the question into the facts or steps it gives you.\n3. Explain how each step supports your conclusion.\nFinal answer: Share a specific problem or expression for a worked answer.`;
}

function practiceText(subject: Subject, question: string): string {
  const answer = subject === "Math" ? arithmeticAnswer(question) : undefined;
  if (answer) return `Practice problem — Medium\nSolve a similar expression by changing one number.\nCheck: follow the same order of operations.`;
  return `Practice problem — Medium\nWrite three sentences explaining ${subject === "Other" ? "the main idea" : `one ${subject.toLowerCase()} concept`} in your own words.\nCheck: include a definition and one example.`;
}

function recordId(question: string): string {
  let hash = 2166136261;
  for (let i = 0; i < question.length; i += 1) hash = Math.imul(hash ^ question.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function anonymousText(question: string): string {
  return question
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b(?:\+?\d[\d -]{7,}\d)\b/g, "[redacted number]");
}

function needsReview(question: string): boolean {
  return /\b(answer my (live |exam|test)|hurt (myself|someone)|make (a )?(weapon|bomb))\b/i.test(question);
}

async function saveQuestion(ctx: Ctx, question: string, subject: Subject, solution: string): Promise<void> {
  const anonymized = anonymousText(question);
  const id = recordId(`${subject}:${anonymized}`);
  const timestamp = now().toISOString();
  await ctx.studyStore.put(`question:${id}`, { text: anonymized, subject, timestamp });
  await ctx.studyStore.put(`solution:${id}`, { steps: solution, final_answer: solution.split("Final answer: ").at(-1), question_id: id });
  const day = timestamp.slice(0, 10);
  const indexKey = `questions:${day}`;
  const ids = (await ctx.studyStore.get<string[]>(indexKey)) ?? [];
  if (!ids.includes(id)) await ctx.studyStore.put(indexKey, [...ids, id]);
  if (needsReview(question)) {
    const flaggedKey = `flagged:${day}`;
    const flagged = (await ctx.studyStore.get<string[]>(flaggedKey)) ?? [];
    if (!flagged.includes(id)) await ctx.studyStore.put(flaggedKey, [...flagged, id]);
  }
}

export { setClock as setStudyClock } from "../clock.js";

async function showSubjectChoice(ctx: Ctx, edit = false): Promise<void> {
  const text = "Choose the subject. If it is unclear, Math is the default.";
  if (edit) await ctx.editMessageText(text, { reply_markup: subjectKeyboard });
  else await ctx.reply(text, { reply_markup: subjectKeyboard });
}

async function answerQuestion(ctx: Ctx, subject: Subject, edit = true): Promise<void> {
  const question = ctx.session.question;
  if (!question) {
    if (edit) await ctx.editMessageText("Start with a question, then choose a subject.");
    else await ctx.reply("Start with a question, then choose a subject.");
    return;
  }
  const solution = solutionText(question, subject);
  await saveQuestion(ctx, question, subject, solution);
  ctx.session.step = undefined;
  ctx.session.expiresAt = undefined;
  const keyboard = inlineKeyboard([
    [inlineButton("Explain more", `study:more:${subject}`), inlineButton("Make it simpler", `study:simple:${subject}`)],
    [inlineButton("Add practice", `study:practice:${subject}`)],
    [inlineButton("Back to menu", "menu:main")],
  ]);
  if (edit) await ctx.editMessageText(solution, { reply_markup: keyboard });
  else await ctx.reply(solution, { reply_markup: keyboard });
}

async function beginQuestion(ctx: Ctx, question?: string, edit = false): Promise<void> {
  const valid = question && cleanQuestion(question);
  if (!valid) {
    ctx.session.step = "awaiting_question";
    ctx.session.expiresAt = now().getTime() + 5 * 60 * 1000;
    const text = "Send the question you want to study.";
    const options = { reply_markup: { force_reply: true as const, input_field_placeholder: "Type your question…" } };
    // ForceReply is valid only on a newly sent message, not an edited inline
    // keyboard message.
    await ctx.reply(text, options);
    return;
  }
  ctx.session.question = valid;
  const subject = inferSubject(valid);
  if (subject) await answerQuestion(ctx, subject, edit);
  else await showSubjectChoice(ctx, edit);
}

composer.command("ask", async (ctx) => {
  const question = ctx.match.trim();
  await beginQuestion(ctx, question || undefined);
});

composer.callbackQuery("study:ask", async (ctx) => { await ctx.answerCallbackQuery(); await beginQuestion(ctx, undefined, true); });
composer.callbackQuery("study:practice", async (ctx) => { await ctx.answerCallbackQuery(); await beginQuestion(ctx, undefined, true); });
composer.callbackQuery(/^subject:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subject = ctx.match[1] as Subject;
  if (!subjects.includes(subject)) { await ctx.editMessageText("That subject is not available. Choose another subject.", { reply_markup: subjectKeyboard }); return; }
  await answerQuestion(ctx, subject);
});
composer.callbackQuery(/^study:more:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Work through one part at a time. Name the rule you are using before moving to the next part.", { reply_markup: inlineKeyboard([[inlineButton("Add practice", `study:practice:${ctx.match[1]}`)], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery(/^study:simple:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Start with the given information. Do one small step, check it, then continue.", { reply_markup: inlineKeyboard([[inlineButton("Add practice", `study:practice:${ctx.match[1]}`)], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery(/^study:practice:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const subject = ctx.match[1] as Subject;
  await ctx.editMessageText(practiceText(subject, ctx.session.question ?? ""), { reply_markup: inlineKeyboard([[inlineButton("Ask another question", "study:ask")], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_question") return next();
  if ((ctx.session.expiresAt ?? 0) < now().getTime()) {
    ctx.session.step = undefined;
    ctx.session.expiresAt = undefined;
    await ctx.reply("That question request expired. Tap Ask a question to start again.");
    return;
  }
  await beginQuestion(ctx, ctx.message.text);
});

export default composer;
