use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    io::{Read, Write},
    path::PathBuf,
    process::Output,
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter, Manager, State, Url};
use uuid::Uuid;

type SharedSessions = Arc<Mutex<HashMap<String, PtySession>>>;

#[cfg(target_os = "macos")]
const MENU_OPEN_FOLDER_ID: &str = "agentrix-open-folder";
#[cfg(target_os = "macos")]
const MENU_APPLY_ZOOM_ID: &str = "agentrix-apply-zoom";
#[cfg(target_os = "macos")]
const MENU_FILL_WINDOW_ID: &str = "agentrix-fill-window";
#[cfg(target_os = "macos")]
const MENU_CENTER_WINDOW_ID: &str = "agentrix-center-window";

const BROWSER_WEBVIEW_LABEL: &str = "agentrix-browser";

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
    Gemini,
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CliStatusPayload {
    provider: String,
    installed: bool,
    authenticated: bool,
    version: Option<String>,
    executable: Option<String>,
    install_message: Option<String>,
    auth_message: Option<String>,
    install_hint: String,
    login_hint: String,
}

#[tauri::command]
fn start_agent_session(
    app: AppHandle,
    registry: State<'_, SessionRegistry>,
    request: StartSessionRequest,
) -> Result<SessionStartedPayload, String> {
    let session_id = Uuid::new_v4().to_string();
    let program = match request.model {
        AgentModel::ClaudeCode => cli_binary("claude"),
        AgentModel::Codex => cli_binary("codex"),
        AgentModel::Gemini => cli_binary("gemini"),
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

    let mut command = CommandBuilder::new(&program);
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
        AgentModel::Gemini => {
            if !request.model_id.trim().is_empty() {
                command.arg("--model");
                command.arg(&request.model_id);
            }
        }
    }

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
    let shell = request
        .shell
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(default_shell);

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
fn browser_navigate(app: AppHandle, url: String) -> Result<(), String> {
    let parsed_url = Url::parse(&url).map_err(|error| format!("URL invalida: {error}"))?;
    let webview = app
        .get_webview(BROWSER_WEBVIEW_LABEL)
        .ok_or_else(|| "Navegador ainda nao foi inicializado.".to_string())?;
    webview
        .navigate(parsed_url)
        .map_err(|error| format!("Falha ao navegar: {error}"))
}

#[tauri::command]
fn browser_back(app: AppHandle) -> Result<(), String> {
    let webview = app
        .get_webview(BROWSER_WEBVIEW_LABEL)
        .ok_or_else(|| "Navegador ainda nao foi inicializado.".to_string())?;
    browser_go_back(webview)
}

#[tauri::command]
fn browser_forward(app: AppHandle) -> Result<(), String> {
    let webview = app
        .get_webview(BROWSER_WEBVIEW_LABEL)
        .ok_or_else(|| "Navegador ainda nao foi inicializado.".to_string())?;
    browser_go_forward(webview)
}

#[tauri::command]
fn browser_reload(app: AppHandle) -> Result<(), String> {
    let webview = app
        .get_webview(BROWSER_WEBVIEW_LABEL)
        .ok_or_else(|| "Navegador ainda nao foi inicializado.".to_string())?;
    browser_reload_webview(webview)
}

#[cfg(windows)]
fn browser_go_back(webview: tauri::Webview) -> Result<(), String> {
    webview
        .with_webview(|platform_webview| unsafe {
            if let Ok(core_webview) = platform_webview.controller().CoreWebView2() {
                let _ = core_webview.GoBack();
            }
        })
        .map_err(|error| format!("Falha ao voltar: {error}"))
}

#[cfg(not(windows))]
fn browser_go_back(webview: tauri::Webview) -> Result<(), String> {
    webview
        .eval("history.back()")
        .map_err(|error| format!("Falha ao voltar: {error}"))
}

#[cfg(windows)]
fn browser_go_forward(webview: tauri::Webview) -> Result<(), String> {
    webview
        .with_webview(|platform_webview| unsafe {
            if let Ok(core_webview) = platform_webview.controller().CoreWebView2() {
                let _ = core_webview.GoForward();
            }
        })
        .map_err(|error| format!("Falha ao avancar: {error}"))
}

#[cfg(not(windows))]
fn browser_go_forward(webview: tauri::Webview) -> Result<(), String> {
    webview
        .eval("history.forward()")
        .map_err(|error| format!("Falha ao avancar: {error}"))
}

#[cfg(windows)]
fn browser_reload_webview(webview: tauri::Webview) -> Result<(), String> {
    webview
        .with_webview(|platform_webview| unsafe {
            if let Ok(core_webview) = platform_webview.controller().CoreWebView2() {
                let _ = core_webview.Reload();
            }
        })
        .map_err(|error| format!("Falha ao recarregar: {error}"))
}

#[cfg(not(windows))]
fn browser_reload_webview(webview: tauri::Webview) -> Result<(), String> {
    webview
        .reload()
        .map_err(|error| format!("Falha ao recarregar: {error}"))
}

#[tauri::command]
fn check_cli_status(provider: String) -> Result<CliStatusPayload, String> {
    let spec = match provider.as_str() {
        "claude-code" => CliSpec {
            provider: "claude-code",
            binary: "claude",
            install_hint: "npm install -g @anthropic-ai/claude-code",
            login_hint: "claude auth login",
        },
        "codex" => CliSpec {
            provider: "codex",
            binary: "codex",
            install_hint: "npm install -g @openai/codex",
            login_hint: "codex --login",
        },
        "gemini" => CliSpec {
            provider: "gemini",
            binary: "gemini",
            install_hint: "npm install -g @google/gemini-cli",
            login_hint: "gemini",
        },
        _ => return Err("Unknown provider".to_string()),
    };

    Ok(check_cli_spec(spec))
}

struct CliSpec {
    provider: &'static str,
    binary: &'static str,
    install_hint: &'static str,
    login_hint: &'static str,
}

fn check_cli_spec(spec: CliSpec) -> CliStatusPayload {
    let binary = resolve_cli_binary(spec.binary);
    let version_output = run_cli_command(&binary, &["--version"]);

    let (installed, version, install_message) =
        match version_output {
            Ok(output) if output.status.success() => (true, first_output_line(&output), None),
            Ok(output) => (
                false,
                None,
                Some(clean_command_output(&output).unwrap_or_else(|| {
                    format!("{} respondeu, mas --version retornou erro.", binary)
                })),
            ),
            Err(error) => (
                false,
                None,
                Some(format!(
                    "{} nao foi encontrado neste ambiente ({error}). Instale com: {}",
                    binary, spec.install_hint
                )),
            ),
        };

    if !installed {
        return CliStatusPayload {
            provider: spec.provider.to_string(),
            installed,
            authenticated: false,
            version,
            executable: None,
            install_message,
            auth_message: Some("Login nao verificado porque o CLI nao esta instalado.".to_string()),
            install_hint: spec.install_hint.to_string(),
            login_hint: spec.login_hint.to_string(),
        };
    }

    let (authenticated, auth_message) = check_cli_auth(spec.provider, &binary);

    CliStatusPayload {
        provider: spec.provider.to_string(),
        installed,
        authenticated,
        version,
        executable: Some(binary),
        install_message,
        auth_message,
        install_hint: spec.install_hint.to_string(),
        login_hint: spec.login_hint.to_string(),
    }
}

fn check_cli_auth(provider: &str, binary: &str) -> (bool, Option<String>) {
    match provider {
        "codex" => {
            if env_var_is_present("OPENAI_API_KEY") {
                return (
                    true,
                    Some("OPENAI_API_KEY encontrado no ambiente do app.".to_string()),
                );
            }
            match run_cli_command(binary, &["login", "status"]) {
                Ok(output) if output.status.success() => (
                    true,
                    clean_command_output(&output)
                        .or_else(|| Some("Codex esta autenticado.".to_string())),
                ),
                Ok(output) => (
                    false,
                    clean_command_output(&output)
                        .or_else(|| Some("Codex instalado, mas login nao confirmado.".to_string())),
                ),
                Err(error) => (
                    false,
                    Some(format!("Falha ao validar login do Codex: {error}")),
                ),
            }
        }
        "claude-code" => match run_cli_command(binary, &["auth", "status", "--text"]) {
            Ok(output) if output.status.success() => (
                true,
                clean_command_output(&output)
                    .or_else(|| Some("Claude Code esta autenticado.".to_string())),
            ),
            Ok(output) => (
                false,
                clean_command_output(&output).or_else(|| {
                    Some("Claude Code instalado, mas login nao confirmado.".to_string())
                }),
            ),
            Err(error) => (
                false,
                Some(format!("Falha ao validar login do Claude Code: {error}")),
            ),
        },
        "gemini" => {
            if env_var_is_present("GEMINI_API_KEY")
                || env_var_is_present("GOOGLE_API_KEY")
                || env_var_is_present("GOOGLE_APPLICATION_CREDENTIALS")
            {
                return (
                    true,
                    Some("Credencial Gemini encontrada no ambiente do app.".to_string()),
                );
            }

            if gemini_oauth_credentials_exist() {
                return (
                    true,
                    Some("Credenciais OAuth do Gemini encontradas em ~/.gemini.".to_string()),
                );
            }

            (
                false,
                Some("Gemini CLI instalado, mas login nao confirmado. Rode gemini e escolha Login with Google ou configure GEMINI_API_KEY.".to_string()),
            )
        }
        _ => (false, Some("Provider desconhecido.".to_string())),
    }
}

fn gemini_oauth_credentials_exist() -> bool {
    home_dir()
        .map(|home| home.join(".gemini").join("oauth_creds.json").is_file())
        .unwrap_or(false)
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        env::var_os("USERPROFILE").map(PathBuf::from)
    }

    #[cfg(not(windows))]
    {
        env::var_os("HOME").map(PathBuf::from)
    }
}

fn run_cli_command(binary: &str, args: &[&str]) -> Result<Output, std::io::Error> {
    std::process::Command::new(binary).args(args).output()
}

fn first_output_line(output: &Output) -> Option<String> {
    clean_command_output(output).and_then(|text| {
        text.lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .map(ToString::to_string)
    })
}

fn clean_command_output(output: &Output) -> Option<String> {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = match (stdout.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{stdout}\n{stderr}"),
        (false, true) => stdout,
        (true, false) => stderr,
        (true, true) => String::new(),
    };
    if combined.is_empty() {
        None
    } else {
        Some(combined)
    }
}

fn env_var_is_present(name: &str) -> bool {
    env::var(name)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

#[tauri::command]
fn host_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }

    #[cfg(target_os = "macos")]
    {
        "macos"
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        "unix"
    }
}

fn cli_binary(name: &str) -> String {
    #[cfg(windows)]
    {
        format!("{name}.cmd")
    }

    #[cfg(not(windows))]
    {
        name.to_string()
    }
}

fn resolve_cli_binary(name: &str) -> String {
    let binary = cli_binary(name);
    if run_cli_command(&binary, &["--version"]).is_ok() {
        return binary;
    }

    for candidate in cli_candidate_paths(name) {
        if candidate.is_file() {
            let candidate = candidate.to_string_lossy().to_string();
            if run_cli_command(&candidate, &["--version"]).is_ok() {
                return candidate;
            }
        }
    }

    binary
}

fn cli_candidate_paths(name: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let binary = cli_binary(name);

    if let Some(path_var) = env::var_os("PATH") {
        paths.extend(env::split_paths(&path_var).map(|path| path.join(&binary)));
    }

    #[cfg(windows)]
    {
        if let Some(appdata) = env::var_os("APPDATA") {
            paths.push(PathBuf::from(appdata).join("npm").join(&binary));
        }
        if let Some(profile) = env::var_os("USERPROFILE") {
            paths.push(
                PathBuf::from(profile)
                    .join("AppData")
                    .join("Roaming")
                    .join("npm")
                    .join(&binary),
            );
        }
        paths.push(PathBuf::from("C:\\Program Files\\nodejs").join(&binary));
    }

    #[cfg(not(windows))]
    {
        paths.push(PathBuf::from("/opt/homebrew/bin").join(&binary));
        paths.push(PathBuf::from("/usr/local/bin").join(&binary));
        if let Some(home) = env::var_os("HOME") {
            let home = PathBuf::from(home);
            paths.push(home.join(".npm-global").join("bin").join(&binary));
            paths.push(home.join(".local").join("bin").join(&binary));
            paths.push(home.join(".claude").join("local").join(&binary));
        }
    }

    paths
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
            status: "waiting".to_string(),
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
        AgentModel::Gemini => "gemini",
    }
}

fn default_shell() -> String {
    #[cfg(windows)]
    {
        if command_is_available("pwsh.exe") {
            "pwsh.exe".to_string()
        } else if command_is_available("powershell.exe") {
            "powershell.exe".to_string()
        } else {
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }
    }

    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

#[cfg(windows)]
fn command_is_available(command: &str) -> bool {
    std::process::Command::new(command)
        .arg("-NoLogo")
        .arg("-NoProfile")
        .arg("-Command")
        .arg("$PSVersionTable.PSVersion")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn add_interactive_shell_args(command: &mut CommandBuilder, shell: &str) {
    let lower = shell.to_ascii_lowercase();
    if lower.ends_with("zsh") || lower.ends_with("bash") || lower.ends_with("fish") {
        command.arg("-l");
    } else if lower.contains("powershell") || lower.ends_with("pwsh.exe") || lower.ends_with("pwsh")
    {
        command.arg("-NoLogo");
    } else if lower.ends_with("cmd.exe") || lower.ends_with("cmd") {
        command.arg("/Q");
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
    let output =
        extract_first_number_after(&lower, "output").unwrap_or(total.saturating_sub(input));

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

#[cfg(target_os = "macos")]
fn install_macos_pt_br_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::menu::{
        AboutMetadata, IconMenuItem, Menu, MenuItem, NativeIcon, PredefinedMenuItem, Submenu,
    };

    let about = PredefinedMenuItem::about(
        app,
        Some("Sobre o Agentrix"),
        Some(AboutMetadata {
            name: Some("Agentrix".to_string()),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            ..Default::default()
        }),
    )?;
    let services = PredefinedMenuItem::services(app, Some("Serviços"))?;
    let hide = PredefinedMenuItem::hide(app, Some("Ocultar Agentrix"))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some("Ocultar Outros"))?;
    let show_all = PredefinedMenuItem::show_all(app, Some("Mostrar Todos"))?;
    let quit = PredefinedMenuItem::quit(app, Some("Encerrar Agentrix"))?;

    let open_folder = IconMenuItem::with_id_and_native_icon(
        app,
        MENU_OPEN_FOLDER_ID,
        "Abrir Pasta...",
        true,
        Some(NativeIcon::Folder),
        Some("CmdOrCtrl+O"),
    )?;
    let close = PredefinedMenuItem::close_window(app, Some("Fechar Janela"))?;

    let undo = PredefinedMenuItem::undo(app, Some("Desfazer"))?;
    let redo = PredefinedMenuItem::redo(app, Some("Refazer"))?;
    let cut = PredefinedMenuItem::cut(app, Some("Recortar"))?;
    let copy = PredefinedMenuItem::copy(app, Some("Copiar"))?;
    let paste = PredefinedMenuItem::paste(app, Some("Colar"))?;
    let select_all = PredefinedMenuItem::select_all(app, Some("Selecionar Tudo"))?;

    let fullscreen = PredefinedMenuItem::fullscreen(app, Some("Entrar em Tela Cheia"))?;

    let minimize = PredefinedMenuItem::minimize(app, Some("Minimizar"))?;
    let apply_zoom = IconMenuItem::with_id_and_native_icon(
        app,
        MENU_APPLY_ZOOM_ID,
        "Aplicar Zoom",
        true,
        Some(NativeIcon::IconView),
        None::<&str>,
    )?;
    let fill_window = IconMenuItem::with_id_and_native_icon(
        app,
        MENU_FILL_WINDOW_ID,
        "Preencher",
        true,
        Some(NativeIcon::EnterFullScreen),
        Some("Ctrl+Cmd+F"),
    )?;
    let center_window = IconMenuItem::with_id_and_native_icon(
        app,
        MENU_CENTER_WINDOW_ID,
        "Centralizar",
        true,
        Some(NativeIcon::ColumnView),
        Some("Ctrl+Cmd+C"),
    )?;
    let bring_all_to_front =
        PredefinedMenuItem::bring_all_to_front(app, Some("Trazer Tudo para Frente"))?;

    let help = MenuItem::new(app, "Ajuda do Agentrix", false, None::<&str>)?;

    let app_menu = Submenu::with_items(
        app,
        "Agentrix",
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(app)?,
            &services,
            &PredefinedMenuItem::separator(app)?,
            &hide,
            &hide_others,
            &show_all,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let file_menu = Submenu::with_items(
        app,
        "Arquivo",
        true,
        &[&open_folder, &PredefinedMenuItem::separator(app)?, &close],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Editar",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &select_all,
        ],
    )?;
    let view_menu = Submenu::with_items(app, "Visualizar", true, &[])?;
    let window_menu = Submenu::with_items(
        app,
        "Janela",
        true,
        &[
            &minimize,
            &apply_zoom,
            &fill_window,
            &center_window,
            &fullscreen,
            &PredefinedMenuItem::separator(app)?,
            &bring_all_to_front,
        ],
    )?;
    let help_menu = Submenu::with_items(app, "Ajuda", true, &[&help])?;

    let menu = Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )?;
    app.set_menu(menu)?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn handle_macos_pt_br_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    if event.id() == MENU_OPEN_FOLDER_ID {
        let _ = app.emit("agentrix-open-folder", ());
        return;
    }

    if event.id() == MENU_APPLY_ZOOM_ID || event.id() == MENU_FILL_WINDOW_ID {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.maximize();
        }
        return;
    }

    if event.id() == MENU_CENTER_WINDOW_ID {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.center();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(SessionRegistry::default())
        .on_menu_event(|app, event| {
            #[cfg(target_os = "macos")]
            handle_macos_pt_br_menu_event(app, event);
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            install_macos_pt_br_menu(app)?;
            #[cfg(not(target_os = "macos"))]
            let _ = app;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_agent_session,
            start_terminal_session,
            write_agent_session,
            stop_agent_session,
            resize_agent_session,
            browser_navigate,
            browser_back,
            browser_forward,
            browser_reload,
            check_cli_status,
            host_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agentrix");
}
