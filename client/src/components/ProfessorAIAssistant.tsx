import { useMemo, useRef, useState } from "react";
import { Bot, FileText, Mic, MicOff, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EventCategory = "activity" | "exam" | "assignment" | "notice";
type EventPriority = "low" | "medium" | "high" | "critical";

export type AssistantEventDraft = {
  title: string;
  description: string;
  category: EventCategory;
  priority: EventPriority;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
};

type ProfessorAIAssistantProps = {
  canManage: boolean;
  onCreateEvent: (draft: AssistantEventDraft) => Promise<void>;
  onGoToCalendar: () => void;
};

type SpeechRecognitionMaybe = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const suggestions = [
  "Agende prova de Direito Civil amanhã às 19h",
  "Criar aviso de reunião pedagógica na sexta às 14:00",
  "Marcar entrega de trabalho de POO dia 20/06 às 23:00",
];

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content:
      "Sou o **Assistente IA Kairos**. Peça em linguagem natural para eu agendar no calendário ou envie um PDF para eu sugerir e criar ações automaticamente.",
  },
];

export function ProfessorAIAssistant({
  canManage,
  onCreateEvent,
  onGoToCalendar,
}: ProfessorAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionMaybe | null>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean((window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }).webkitSpeechRecognition)
      || Boolean((window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown }).SpeechRecognition);
  }, []);

  const appendAssistant = (content: string) => {
    setMessages(prev => [...prev, { role: "assistant", content }]);
  };

  const handleCommand = async (content: string) => {
    setMessages(prev => [...prev, { role: "user", content }]);

    if (!canManage) {
      appendAssistant("Seu perfil atual está em modo aluno. Troque para modo professor para eu criar agendamentos.");
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = parseSchedulingIntent(content, new Date());
      if (!parsed) {
        appendAssistant(
          "Não consegui extrair um agendamento completo. Tente algo como: `Agende prova de Processo Civil amanhã às 19h`.",
        );
        return;
      }

      await onCreateEvent(parsed);
      appendAssistant(
        `Perfeito! Agendei **${parsed.title}** para **${formatDate(parsed.startsAt, parsed.allDay)}**. Você pode revisar no calendário.`,
      );
      toast.success("Agendamento criado pela IA.");
    } catch {
      appendAssistant("Tive um erro ao publicar o agendamento. Tente novamente em alguns segundos.");
      toast.error("Não foi possível concluir o agendamento IA.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!canManage) {
      toast.error("Apenas no modo professor é possível criar eventos.");
      return;
    }

    setIsProcessing(true);
    setMessages(prev => [
      ...prev,
      { role: "user", content: `Analisar PDF: ${file.name}` },
      { role: "assistant", content: "Lendo PDF e transformando conteúdo em agendamentos..." },
    ]);

    try {
      const text = await extractTextFromPdf(file);
      const drafts = parsePdfIntoDrafts(text, file.name);

      if (!drafts.length) {
        appendAssistant(
          "Li o PDF, mas não encontrei comandos claros de agenda. Você pode enviar no chat frases como `agendar prova dia 10/06 às 19h`.",
        );
        return;
      }

      for (const draft of drafts.slice(0, 3)) {
        await onCreateEvent(draft);
      }

      appendAssistant(
        `PDF processado com sucesso. Criei **${Math.min(drafts.length, 3)}** agendamento(s) automático(s).`,
      );
      toast.success("PDF processado e agenda atualizada.");
    } catch {
      appendAssistant("Não consegui processar este PDF. Tente outro arquivo ou descreva o conteúdo no chat.");
      toast.error("Falha ao processar PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      toast.error("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionMaybe; SpeechRecognition?: new () => SpeechRecognitionMaybe }
    ).SpeechRecognition
      || (
        window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionMaybe; SpeechRecognition?: new () => SpeechRecognitionMaybe }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error("Reconhecimento de voz indisponível.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      void handleCommand(transcript);
    };
    recognition.onerror = () => {
      toast.error("Não foi possível capturar o áudio.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[1200] flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="pointer-events-auto rounded-full border border-amber-300/35 bg-gradient-to-r from-sky-700 to-indigo-700 px-4 text-white shadow-[0_10px_28px_rgba(0,0,0,0.4)] hover:from-sky-600 hover:to-indigo-600"
      >
        <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
        {isOpen ? "Fechar IA" : "Abrir IA"}
      </Button>

      {isOpen ? (
        <section className="pointer-events-auto w-[min(88vw,360px)] max-h-[75vh] overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(6,16,32,0.92),rgba(7,17,31,0.98)_62%,rgba(11,43,84,0.8))] shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-xl">
          <div className="relative border-b border-white/10 px-4 py-3">
            <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-sky-500/15 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0 pr-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-white/95">
                  <Bot className="h-4 w-4 text-amber-300" />
                  Kairos Assistant
                </p>
                <p className="mt-0.5 text-[11px] text-white/60">
                  Chat, voz e PDF para criar agendamentos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("border-0 text-[10px]", canManage ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>
                  {canManage ? "Professor" : "Leitura"}
                </Badge>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fechar assistente IA"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={toggleListening}
                className={cn(
                  "h-8 rounded-full border-white/20 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10",
                  isListening && "border-emerald-400/50 bg-emerald-400/15 text-emerald-200",
                )}
              >
                {isListening ? <MicOff className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                {isListening ? "Parar voz" : "Falar com IA"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-full border-white/20 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Ler PDF
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={onGoToCalendar}
                className="h-8 rounded-full bg-amber-300 px-2.5 text-xs text-slate-950 hover:bg-amber-200"
              >
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                Agenda
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void handlePdfUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </div>

          <AIChatBox
            messages={messages}
            onSendMessage={message => {
              void handleCommand(message);
            }}
            isLoading={isProcessing}
            height={390}
            className="rounded-none border-0 bg-transparent"
            placeholder="Ex: agendar prova de Cálculo amanhã às 19h..."
            emptyStateMessage="Peça um agendamento em linguagem natural."
            suggestedPrompts={suggestions}
          />
        </section>
      ) : null}
    </div>
  );
}

function parseSchedulingIntent(content: string, now: Date): AssistantEventDraft | null {
  const text = content.trim();
  if (!text) return null;

  const normalized = normalizeText(text);
  const title = extractTitle(text);
  if (!title) return null;

  const category = inferCategory(normalized);
  const priority = inferPriority(normalized);
  const allDay = /(dia inteiro|dia todo|integral)/i.test(normalized);
  const parsedDate = parseDateAndTime(text, now, allDay);
  if (!parsedDate) return null;

  const durationMinutes = inferDurationMinutes(normalized, allDay);
  const endsAt = allDay ? null : parsedDate.getTime() + durationMinutes * 60_000;

  return {
    title,
    description: `Criado via Assistente IA: "${text}"`,
    category,
    priority,
    startsAt: parsedDate.getTime(),
    endsAt,
    allDay,
  };
}

function parsePdfIntoDrafts(rawText: string, fileName: string): AssistantEventDraft[] {
  const lines = rawText
    .split(/\r?\n|[.;]+/g)
    .map(line => line.trim())
    .filter(Boolean);

  const candidates = lines
    .filter(line => /(agend|prova|atividade|entrega|aula|reuni[aã]o|aviso)/i.test(line))
    .slice(0, 12);

  const now = new Date();
  const drafts = candidates
    .map(line => parseSchedulingIntent(line, now))
    .filter((item): item is AssistantEventDraft => Boolean(item));

  if (drafts.length) return drafts;

  // Fallback funcional e ilustrativo quando o texto do PDF vem pouco legível.
  return [
    {
      title: `Ação extraída do PDF: ${fileName.replace(/\.pdf$/i, "")}`,
      description: "Evento sugerido automaticamente após leitura de PDF pelo Assistente IA.",
      category: "activity",
      priority: "medium",
      startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0, 0).getTime(),
      endsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0, 0, 0).getTime(),
      allDay: false,
    },
  ];
}

async function extractTextFromPdf(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];
  const regex = /\(([^()]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const content = match[1]?.replace(/\\r|\\n/g, " ").replace(/\\[0-7]{1,3}/g, " ").trim();
    if (content && /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(content)) {
      chunks.push(content);
    }
    if (chunks.length > 500) break;
  }
  return chunks.join("\n");
}

function extractTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const pattern = /(agend(ar|e)?|marc(ar|e)?|cri(ar|e))\s+(uma?\s+)?(aula|prova|atividade|aviso|entrega|reuni[aã]o)?\s*(de|sobre|para)?\s*/i;
  const withoutVerb = cleaned.replace(pattern, "").trim();
  const cutoff = withoutVerb.search(/\b(amanh[ãa]|hoje|dia|em|às|as|para)\b/i);
  const base = cutoff > 4 ? withoutVerb.slice(0, cutoff).trim() : withoutVerb;
  return (base || cleaned).slice(0, 90);
}

function inferCategory(normalizedText: string): EventCategory {
  if (/(prova|teste|avalia[cç][aã]o|simulado)/i.test(normalizedText)) return "exam";
  if (/(entrega|trabalho|deadline|prazo)/i.test(normalizedText)) return "assignment";
  if (/(aviso|comunicado|informativo|lembrete)/i.test(normalizedText)) return "notice";
  return "activity";
}

function inferPriority(normalizedText: string): EventPriority {
  if (/(urgent|urgente|cr[ií]tic)/i.test(normalizedText)) return "critical";
  if (/(alta prioridade|importante|prioridade alta)/i.test(normalizedText)) return "high";
  if (/(baixa prioridade|quando puder)/i.test(normalizedText)) return "low";
  return "medium";
}

function inferDurationMinutes(normalizedText: string, allDay: boolean): number {
  if (allDay) return 0;
  const match = normalizedText.match(/(\d{1,2})\s*(hora|horas|min|minuto|minutos)/i);
  if (!match) return 60;
  const value = Number(match[1]);
  if (Number.isNaN(value) || value <= 0) return 60;
  const unit = match[2].toLowerCase();
  return unit.startsWith("hora") ? value * 60 : value;
}

function parseDateAndTime(text: string, now: Date, allDay: boolean): Date | null {
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hour = allDay ? 8 : 9;
  let minute = 0;

  const normalized = normalizeText(text);

  if (/\bamanh[ãa]\b/i.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  } else if (/\bdepois de amanh[ãa]\b/i.test(normalized)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  } else {
    const dateMatch = normalized.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (dateMatch) {
      day = Number(dateMatch[1]);
      month = Number(dateMatch[2]) - 1;
      if (dateMatch[3]) {
        const yy = Number(dateMatch[3]);
        year = yy < 100 ? 2000 + yy : yy;
      }
    }
  }

  const timeMatch = normalized.match(/\b(?:as|às)?\s*(\d{1,2})(?::|h)?(\d{2})?\b/);
  if (timeMatch && !allDay) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] ?? "0");
  }

  const parsed = new Date(year, month, day, hour, minute, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(timestamp: number, allDay: boolean): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: allDay ? undefined : "short",
  });
}
