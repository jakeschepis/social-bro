interface ExportScriptOptions {
  title: string;
  hooks: string[];
  content: string;
  scriptType?: "single-subject" | "multi-subject";
}

const WORDS_PER_MINUTE = 150;

function formatTimestamp(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function exportScriptAsMarkdown(
  options: ExportScriptOptions
): string {
  const { title, hooks, content } = options;

  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");

  if (hooks.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Hooks");
    lines.push("");

    hooks.forEach((hook, index) => {
      lines.push(`### Hook ${index + 1}`);
      lines.push(hook);
      lines.push("");
    });

    lines.push("---");
    lines.push("");
  }

  lines.push("## Script");
  lines.push("");

  let cumulativeWords = 0;

  paragraphs.forEach((paragraph, index) => {
    if (index === 0) {
      lines.push(paragraph);
      lines.push("");
      cumulativeWords += countWords(paragraph);
    } else {
      const elapsedSeconds = (cumulativeWords / WORDS_PER_MINUTE) * 60;
      const timestamp = formatTimestamp(elapsedSeconds);
      lines.push(timestamp);
      lines.push(paragraph);
      lines.push("");
      cumulativeWords += countWords(paragraph);
    }
  });

  return lines.join("\n").trimEnd() + "\n";
}

export function downloadMarkdownFile(
  content: string,
  filename: string
): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + "-script.md"
  );
}
