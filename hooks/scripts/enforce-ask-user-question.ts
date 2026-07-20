/**
 * Stop hook: если финальный ответ ассистента заканчивается ТЕКСТОВЫМ вопросом
 * с вариантами выбора — блокируем завершение и требуем переспросить через
 * AskUserQuestion. Детектор консервативный: лучше пропустить, чем ложно
 * заблокировать нормальный ответ со списком.
 *
 * Вход (stdin, JSON): { transcript_path, stop_hook_active, ... }
 * Выход: {"decision":"block","reason":"..."} либо пусто (разрешить стоп).
 */
import { readFileSync } from "node:fs";

interface ContentBlock {
  type: string;
  text?: string;
}

function asciiJson(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[^\x00-\x7f]/g,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

function lastAssistantText(transcriptPath: string): string {
  const lines = readFileSync(transcriptPath, "utf8").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (!line) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "assistant") continue;
    const blocks: ContentBlock[] = entry?.message?.content ?? [];
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) return text; // последний assistant-текст и есть хвост ответа
  }
  return "";
}

/** Хвост ответа: последние 25 непустых строк. */
function tailLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-25);
}

function isTextualChoiceQuestion(text: string): boolean {
  const tail = tailLines(text);
  if (tail.length === 0) return false;
  const tailStr = tail.join("\n");
  // Для поиска вопросов срезаем markdown-разметку («**…?**» → «…?»)
  const plain = tail.map((l) => l.replace(/[*_`]+/g, "").trim());

  // Строки-варианты: "A. ...", "- **B.**", "1) ...", "**2.** ..."
  const optionLine = /^(?:[-*]\s+)?(?:\*\*)?(?:[A-GА-Е]|\d{1,2})(?:\*\*)?[.)]\s/;
  const optionCount = tail.filter((l) => optionLine.test(l)).length;

  // Вопросительные триггеры выбора
  const trigger =
    /(как(ой|ую|ие|им)\s+(вариант|выб|подход|способ)|выбира(ешь|ете)|выбери|что\s+(выбираешь|скажешь)|можно\s+ли|продолжа(ем|ть)\s*\?|фиксируем\s*\?|скажи,?\s+(можно|какой|какие|что|нужны))/i;

  // Правило 1: есть список вариантов (>=2) и вопрос рядом
  if (optionCount >= 2 && (trigger.test(tailStr) || plain.some((l) => /\?$/.test(l)))) {
    return true;
  }
  // Правило 2: явная просьба ответить текстом («скажи, можно ли…») даже без списка
  if (/скажи,?\s+(можно\s+ли|какой|какие|что\s+измен|нужны\s+ли)/i.test(tailStr)) {
    return true;
  }
  return false;
}

let input: any = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

// Защита от зацикливания: уже блокировали этот стоп — пропускаем.
if (input?.stop_hook_active) process.exit(0);

const transcriptPath: string | undefined = input?.transcript_path;
if (!transcriptPath) process.exit(0);

let text = "";
try {
  text = lastAssistantText(transcriptPath);
} catch {
  process.exit(0); // транскрипт не прочитался — никогда не ломаем стоп
}

if (text && isTextualChoiceQuestion(text)) {
  process.stdout.write(
    asciiJson({
      decision: "block",
      reason:
        "Твой ответ заканчивается текстовым вопросом с вариантами выбора. По правилам пользователя такие вопросы задаются ТОЛЬКО инструментом AskUserQuestion. Повтори содержательную часть ответа без финального вопроса и вызови AskUserQuestion с теми же вариантами (2-4 опции, рекомендуемая — первой с пометкой '(Recommended)'). Если это было утверждение плана в plan mode — используй ExitPlanMode.",
    }),
  );
}
process.exit(0);
