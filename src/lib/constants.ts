import type { AgentModel, AgentRole, AgentTemplate, ReasoningEffort } from "@/lib/types";

export const ROLE_LABELS: Record<AgentRole, string> = {
  CODER: "Coder",
  THINKER: "Thinker",
  REVIEWER: "Reviewer",
  RESEARCHER: "Researcher",
  CUSTOM: "Custom",
};

export const ROLE_PROMPTS: Record<AgentRole, string> = {
  CODER: "Especialista em desenvolvimento de software e escrita de codigo. Priorize implementacoes pequenas, testaveis e alinhadas ao repositorio.",
  THINKER: "Especialista em arquitetura e raciocinio passo a passo. Quebre problemas complexos em decisoes tecnicas verificaveis.",
  REVIEWER: "Especialista em revisao de codigo, bugs e seguranca. Priorize achados por severidade e indique linhas relevantes.",
  RESEARCHER: "Especialista em pesquisa, contexto e documentacao. Busque fontes primarias e sintetize achados com referencias.",
  CUSTOM: "Descreva o comportamento esperado deste agente.",
};

export const DEFAULT_TEMPLATES: AgentTemplate[] = [
  { role: "CODER", name: "Coder", color: "accent", prompt: ROLE_PROMPTS.CODER },
  { role: "THINKER", name: "Thinker", color: "success", prompt: ROLE_PROMPTS.THINKER },
  { role: "REVIEWER", name: "Reviewer", color: "error", prompt: ROLE_PROMPTS.REVIEWER },
  { role: "RESEARCHER", name: "Researcher", color: "text-muted", prompt: ROLE_PROMPTS.RESEARCHER },
];

export const MODEL_COST_PER_1K: Record<string, number> = {
  "claude-code": 0.015,
  codex: 0.01,
  gemini: 0.0,
};

export interface CliModelOption {
  provider: AgentModel;
  id: string;
  label: string;
  description: string;
  reasoning: ReasoningEffort[];
}

export const REASONING_EFFORTS: ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh"];

export const CLI_MODELS: CliModelOption[] = [
  {
    provider: "claude-code",
    id: "sonnet",
    label: "Claude Sonnet",
    description: "Alias Claude Code para o Sonnet mais recente.",
    reasoning: ["none"],
  },
  {
    provider: "claude-code",
    id: "opus",
    label: "Claude Opus",
    description: "Alias Claude Code para o Opus mais capaz.",
    reasoning: ["none"],
  },
  {
    provider: "claude-code",
    id: "haiku",
    label: "Claude Haiku",
    description: "Alias Claude Code rapido para tarefas simples.",
    reasoning: ["none"],
  },
  {
    provider: "claude-code",
    id: "sonnet[1m]",
    label: "Claude Sonnet 1M",
    description: "Alias Claude Code com janela de contexto estendida.",
    reasoning: ["none"],
  },
  {
    provider: "claude-code",
    id: "opusplan",
    label: "Claude Opus Plan",
    description: "Opus no planejamento e Sonnet na execucao.",
    reasoning: ["none"],
  },
  {
    provider: "codex",
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Modelo frontier para coding e trabalho profissional.",
    reasoning: ["none", "low", "medium", "high", "xhigh"],
  },
  {
    provider: "codex",
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Modelo frontier mais acessivel para workflows agenticos.",
    reasoning: ["none", "low", "medium", "high", "xhigh"],
  },
  {
    provider: "codex",
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Modelo menor para menor latencia e custo.",
    reasoning: ["none", "low", "medium", "high", "xhigh"],
  },
  {
    provider: "codex",
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    description: "Modelo especializado para agentic coding no Codex.",
    reasoning: ["low", "medium", "high", "xhigh"],
  },
  {
    provider: "codex",
    id: "gpt-5.2-codex",
    label: "GPT-5.2 Codex",
    description: "Modelo Codex para tarefas longas de desenvolvimento.",
    reasoning: ["low", "medium", "high", "xhigh"],
  },
  {
    provider: "codex",
    id: "gpt-5.1-codex",
    label: "GPT-5.1 Codex",
    description: "Versao GPT-5.1 otimizada para Codex.",
    reasoning: ["low", "medium", "high"],
  },
  {
    provider: "codex",
    id: "gpt-5-codex",
    label: "GPT-5 Codex",
    description: "Versao GPT-5 otimizada para ambientes Codex.",
    reasoning: ["minimal", "low", "medium", "high"],
  },
  {
    provider: "gemini",
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Modelo padrao do Gemini CLI para tarefas de codigo.",
    reasoning: ["none"],
  },
  {
    provider: "gemini",
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Modelo Gemini mais rapido para iteracoes leves.",
    reasoning: ["none"],
  },
];
