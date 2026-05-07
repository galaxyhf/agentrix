use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

type SharedSessions = Arc<Mutex<HashMap<String, PtySession>>>;

struct PtySession {
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send>,
    master: Box<dyn MasterPty + Send>,
}

#[derive(Default)]
struct SessionRegistry {
    sessions: SharedSessions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSessionRequest {
    agent_id: String,
    model: AgentModel,
    model_id: String,
    reasoning_effort: ReasoningEffort,
    role: AgentRole,
    system_prompt: String,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartTerminalRequest {
    agent_id: String,
    model: AgentModel,
    model_id: String,
    reasoning_effort: ReasoningEffort,
    role: AgentRole,
    system_prompt: String,
    cwd: Option<String>,
    shell: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AgentModel {
    ClaudeCode,
    Codex,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum AgentRole {
    Coder,
    Thinker,
    Reviewer,
    Researcher,
    Custom,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum ReasoningEffort {
    None,
    Minimal,
    Low,
    Medium,
    High,
    Xhigh,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionStartedPayload {
    agent_id: String,
    session_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionOutputPayload {
    agent_id: String,
    session_id: String,
    data: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionStatusPayload {
    agent_id: String,
    session_id: String,
    status: String,
    message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TokenUsagePayload {
    agent_id: String,
    session_id: String,
    input_tokens: u64,
    output_tokens: u64,
    total_tokens: u64,
    estimated_cost: f64,
}

#[tauri::command]
fn start_agent_session(
    app: AppHandle,
    registry: State<'_, SessionRegistry>,
    request: StartSessionRequest,
) -> Result<SessionStartedPayload, String> {
    let session_id = Uuid::new_v4().to_string();
    let program = match request.model {
        AgentModel::ClaudeCode => "claude",
        AgentModel::Codex => "codex",
    };

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: request.rows.unwrap_or(28),
            cols: request.cols.unwrap_or(100),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Failed to open PTY: {error}"))?;

    let mut command = CommandBuilder::new(program);
    match request.model {
        AgentModel::ClaudeCode => {
            if !request.model_id.trim().is_empty() {
                command.arg("--model");
                command.arg(&request.model_id);
            }
        }
        AgentModel::Codex => {
            if !request.model_id.trim().is_empty() {
                command.arg("--model");
                command.arg(&request.model_id);
            }
            if let Some(effort) = codex_reasoning_effort(&request.reasoning_effort) {
                command.arg("-c");
                command.arg(format!("model_reasoning_effort=\"{effort}\""));
            }
        }
    }

    if let Some(cwd) = &request.cwd {
        command.cwd(cwd);
    }

    command.env("AGENTRIX_AGENT_ID", &request.agent_id);
    command.env("AGENTRIX_AGENT_ROLE", role_label(&request.role));
    command.env("AGENTRIX_SYSTEM_PROMPT", &request.system_prompt);
    command.env("AGENTRIX_MODEL_ID", &request.model_id);

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Failed to start {program}: {error}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Failed to attach PTY writer: {error}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Failed to attach PTY reader: {error}"))?;

    let session = PtySession {
        writer,
        child,
        master: pair.master,
    };

    registry
        .sessions
        .lock()
        .map_err(|_| "Session registry is unavailable".to_string())?
        .insert(session_id.clone(), session);

    let started = SessionStartedPayload {
        agent_id: request.agent_id.clone(),
        session_id: session_id.clone(),
    };
    let _ = app.emit("agent-session-started", started.clone());

    spawn_reader(app, request.agent_id, session_id, reader);

    Ok(started)
}

#[tauri::command]
fn start_terminal_session(
    app: AppHandle,
    registry: State<'_, SessionRegistry>,
    request: StartTerminalRequest,
) -> Result<SessionStartedPayload, String> {
    let session_id = Uuid::new_v4().to_string();
    let shell = request.shell.filter(|value| !value.trim().is_empty()).unwrap_or_else(default_shell);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: request.rows.unwrap_or(28),
            cols: request.cols.unwrap_or(100),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Failed to open PTY: {error}"))?;

    let mut command = CommandBuilder::new(&shell);
    add_interactive_shell_args(&mut command, &shell);

    if let Some(cwd) = &request.cwd {
        command.cwd(cwd);
    }

    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("AGENTRIX_AGENT_ID", &request.agent_id);
    command.env("AGENTRIX_AGENT_ROLE", role_label(&request.role));
    command.env("AGENTRIX_SYSTEM_PROMPT", &request.system_prompt);
    command.env("AGENTRIX_PROVIDER", provider_label(&request.model));
    command.env("AGENTRIX_MODEL_ID", &request.model_id);
    if let Some(effort) = codex_reasoning_effort(&request.reasoning_effort) {
        command.env("AGENTRIX_REASONING_EFFORT", effort);
    }
    if matches!(request.model, AgentModel::ClaudeCode) && !request.model_id.trim().is_empty() {
        command.env("ANTHROPIC_MODEL", &request.model_id);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Failed to start shell {shell}: {error}"))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Failed to attach PTY writer: {error}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Failed to attach PTY reader: {error}"))?;

    let session = PtySession {
        writer,
        child,
        master: pair.master,
    };

    registry
        .sessions
        .lock()
        .map_err(|_| "Session registry is unavailable".to_string())?
        .insert(session_id.clone(), session);

    let started = SessionStartedPayload {
        agent_id: request.agent_id.clone(),
        session_id: session_id.clone(),
    };
    let _ = app.emit("agent-session-started", started.clone());

    spawn_reader(app, request.agent_id, session_id, reader);

    Ok(started)
}

#[tauri::command]
fn write_agent_session(
    registry: State<'_, SessionRegistry>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = registry
        .sessions
        .lock()
        .map_err(|_| "Session registry is unavailable".to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|error| format!("Failed to write to PTY: {error}"))?;
    session
        .writer
        .flush()
        .map_err(|error| format!("Failed to flush PTY: {error}"))?;
    Ok(())
}

#[tauri::command]
fn stop_agent_session(
    registry: State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = registry
        .sessions
        .lock()
        .map_err(|_| "Session registry is unavailable".to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        session
            .child
            .kill()
            .map_err(|error| format!("Failed to stop PTY process: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn resize_agent_session(
    registry: State<'_, SessionRegistry>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = registry
        .sessions
        .lock()
        .map_err(|_| "Session registry is unavailable".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Failed to resize PTY: {error}"))?;
    Ok(())
}

#[tauri::command]
fn check_cli_status(provider: String) -> Result<String, String> {
    let binary = match provider.as_str() {
        "claude-code" => "claude",
        "codex" => "codex",
        _ => return Err("Unknown provider".to_string()),
    };

    let status = std::process::Command::new(binary)
        .arg("--version")
        .output()
        .map_err(|error| format!("{binary} CLI unavailable: {error}"))?;

    if status.status.success() {
        Ok(String::from_utf8_lossy(&status.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&status.stderr).trim().to_string())
    }
}

fn spawn_reader(
    app: AppHandle,
    agent_id: String,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
) {
    let _ = app.emit(
        "agent-session-status",
        SessionStatusPayload {
            agent_id: agent_id.clone(),
            session_id: session_id.clone(),
            status: "running".to_string(),
            message: None,
        },
    );

    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = app.emit(
                        "agent-session-output",
                        SessionOutputPayload {
                            agent_id: agent_id.clone(),
                            session_id: session_id.clone(),
                            data: data.clone(),
                        },
                    );
                    if let Some(usage) = detect_token_usage(&agent_id, &session_id, &data) {
                        let _ = app.emit("agent-token-usage", usage);
                    }
                }
                Err(error) => {
                    let _ = app.emit(
                        "agent-session-status",
                        SessionStatusPayload {
                            agent_id: agent_id.clone(),
                            session_id: session_id.clone(),
                            status: "error".to_string(),
                            message: Some(error.to_string()),
                        },
                    );
                    return;
                }
            }
        }

        let _ = app.emit(
            "agent-session-status",
            SessionStatusPayload {
                agent_id,
                session_id,
                status: "idle".to_string(),
                message: None,
            },
        );
    });
}

fn role_label(role: &AgentRole) -> &'static str {
    match role {
        AgentRole::Coder => "CODER",
        AgentRole::Thinker => "THINKER",
        AgentRole::Reviewer => "REVIEWER",
        AgentRole::Researcher => "RESEARCHER",
        AgentRole::Custom => "CUSTOM",
    }
}

fn provider_label(model: &AgentModel) -> &'static str {
    match model {
        AgentModel::ClaudeCode => "claude-code",
        AgentModel::Codex => "codex",
    }
}

fn default_shell() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }

    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

fn add_interactive_shell_args(command: &mut CommandBuilder, shell: &str) {
    let lower = shell.to_ascii_lowercase();
    if lower.ends_with("zsh") || lower.ends_with("bash") || lower.ends_with("fish") {
        command.arg("-l");
    } else if lower.contains("powershell") || lower.ends_with("pwsh.exe") || lower.ends_with("pwsh") {
        command.arg("-NoLogo");
    }
}

fn codex_reasoning_effort(effort: &ReasoningEffort) -> Option<&'static str> {
    match effort {
        ReasoningEffort::None => None,
        ReasoningEffort::Minimal => Some("minimal"),
        ReasoningEffort::Low => Some("low"),
        ReasoningEffort::Medium => Some("medium"),
        ReasoningEffort::High => Some("high"),
        ReasoningEffort::Xhigh => Some("xhigh"),
    }
}

#[allow(dead_code)]
fn detect_token_usage(agent_id: &str, session_id: &str, chunk: &str) -> Option<TokenUsagePayload> {
    let lower = chunk.to_ascii_lowercase();
    if !lower.contains("token") {
        return None;
    }

    let total = extract_first_number_after(&lower, "total")
        .or_else(|| extract_first_number_before(&lower, "tokens"))?;
    let input = extract_first_number_after(&lower, "input").unwrap_or(total / 2);
    let output = extract_first_number_after(&lower, "output").unwrap_or(total.saturating_sub(input));

    Some(TokenUsagePayload {
        agent_id: agent_id.to_string(),
        session_id: session_id.to_string(),
        input_tokens: input,
        output_tokens: output,
        total_tokens: total,
        estimated_cost: (total as f64 / 1000.0) * 0.01,
    })
}

fn extract_first_number_after(text: &str, marker: &str) -> Option<u64> {
    let index = text.find(marker)?;
    extract_first_u64(&text[index..])
}

fn extract_first_number_before(text: &str, marker: &str) -> Option<u64> {
    let index = text.find(marker)?;
    extract_first_u64(&text[..index])
}

fn extract_first_u64(text: &str) -> Option<u64> {
    let mut number = String::new();
    for ch in text.chars() {
        if ch.is_ascii_digit() {
            number.push(ch);
        } else if !number.is_empty() {
            break;
        }
    }
    number.parse().ok()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(SessionRegistry::default())
        .invoke_handler(tauri::generate_handler![
            start_agent_session,
            start_terminal_session,
            write_agent_session,
            stop_agent_session,
            resize_agent_session,
            check_cli_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agentrix");
}
