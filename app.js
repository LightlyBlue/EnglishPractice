const MAX_RECORDING_MS = 90_000;
const DB_NAME = "speaksprint-db";
const DB_VERSION = 1;
const RECORDING_STORE = "recordings";
const DEFAULT_API_BASE_URL = "";
const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";
const CHAT_MODEL_OPTIONS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"];
const TRANSCRIBE_MODEL_OPTIONS = ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"];
const TTS_MODEL_OPTIONS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"];

const topicPresets = {
  travel: "旅行沟通：例如问路、订酒店、机场值机、解决行程问题。",
  interview: "英语面试：例如自我介绍、项目经历、优势与挑战。",
  daily: "日常闲聊：例如兴趣爱好、周末安排、朋友聚会、最近生活。",
  meeting: "工作会议：例如项目同步、提问、表达观点、推进任务。",
  study: "校园学习：例如课程讨论、作业交流、和老师或同学沟通。",
  custom: "",
};

const state = {
  apiKey: localStorage.getItem("speaksprint-api-key") || "",
  apiBaseUrl: localStorage.getItem("speaksprint-api-base-url") || DEFAULT_API_BASE_URL,
  chatModel: localStorage.getItem("speaksprint-chat-model") || DEFAULT_CHAT_MODEL,
  transcribeModel:
    localStorage.getItem("speaksprint-transcribe-model") || DEFAULT_TRANSCRIBE_MODEL,
  ttsModel: localStorage.getItem("speaksprint-tts-model") || DEFAULT_TTS_MODEL,
  ttsVoice: localStorage.getItem("speaksprint-tts-voice") || DEFAULT_TTS_VOICE,
  conversation: [],
  sessionActive: false,
  mediaStream: null,
  audioContext: null,
  sourceNode: null,
  processorNode: null,
  pcmChunks: [],
  sampleRate: 16000,
  isRecording: false,
  isRecordingPaused: false,
  remainingRecordingMs: MAX_RECORDING_MS,
  speechRecognition: null,
  speechRecognitionSupported: false,
  liveTranscriptFinal: "",
  liveTranscriptInterim: "",
  currentBlob: null,
  currentBlobUrl: "",
  currentPlaybackUrl: "",
  currentPlaybackAudio: null,
  currentPlaybackMode: "",
  currentPlaybackMessageId: "",
  isPlaybackPaused: false,
  modelStatus: {
    chat: { state: "pending", label: "未验证" },
    transcribe: { state: "pending", label: "未验证" },
    tts: { state: "pending", label: "未验证" },
  },
  activeSessionToken: 0,
  recordingStartAt: 0,
  countdownInterval: null,
  countdownEndAt: 0,
  turnCount: 0,
  practiceTopic: "",
};

const els = {
  apiKey: document.querySelector("#apiKey"),
  apiBaseUrl: document.querySelector("#apiBaseUrl"),
  topicPreset: document.querySelector("#topicPreset"),
  customTopic: document.querySelector("#customTopic"),
  level: document.querySelector("#level"),
  chatModelPreset: document.querySelector("#chatModelPreset"),
  chatModel: document.querySelector("#chatModel"),
  transcribeModelPreset: document.querySelector("#transcribeModelPreset"),
  transcribeModel: document.querySelector("#transcribeModel"),
  ttsModelPreset: document.querySelector("#ttsModelPreset"),
  ttsModel: document.querySelector("#ttsModel"),
  ttsVoice: document.querySelector("#ttsVoice"),
  chatModelStatus: document.querySelector("#chatModelStatus"),
  transcribeModelStatus: document.querySelector("#transcribeModelStatus"),
  ttsModelStatus: document.querySelector("#ttsModelStatus"),
  modelStatusNote: document.querySelector("#modelStatusNote"),
  panelMenuBtn: document.querySelector("#panelMenuBtn"),
  panelMenu: document.querySelector("#panelMenu"),
  currentPanelLabel: document.querySelector("#currentPanelLabel"),
  practiceMenuItem: document.querySelector("#practiceMenuItem"),
  configMenuItem: document.querySelector("#configMenuItem"),
  panelStage: document.querySelector("#panelStage"),
  practicePanel: document.querySelector("#practicePanel"),
  practicePanelSecondary: document.querySelector("#practicePanelSecondary"),
  configPanel: document.querySelector("#configPanel"),
  configPanelSecondary: document.querySelector("#configPanelSecondary"),
  startSessionBtn: document.querySelector("#startSessionBtn"),
  endSessionBtn: document.querySelector("#endSessionBtn"),
  recordBtn: document.querySelector("#recordBtn"),
  redoBtn: document.querySelector("#redoBtn"),
  sendBtn: document.querySelector("#sendBtn"),
  timerLabel: document.querySelector("#timerLabel"),
  recordIndicator: document.querySelector("#recordIndicator"),
  captionStatus: document.querySelector("#captionStatus"),
  liveTranscript: document.querySelector("#liveTranscript"),
  draftPlayer: document.querySelector("#draftPlayer"),
  chatLog: document.querySelector("#chatLog"),
  recordingsList: document.querySelector("#recordingsList"),
  sessionBadge: document.querySelector("#sessionBadge"),
  messageTemplate: document.querySelector("#messageTemplate"),
  recordingTemplate: document.querySelector("#recordingTemplate"),
};

bootstrap();

function bootstrap() {
  migrateLegacyModelDefaults();
  initSpeechRecognitionSupport();
  els.apiKey.value = state.apiKey;
  els.apiBaseUrl.value = state.apiBaseUrl;
  hydrateModelControl("chat");
  hydrateModelControl("transcribe");
  hydrateModelControl("tts");
  els.ttsVoice.value = state.ttsVoice;
  els.topicPreset.value = "travel";
  updateTopicPlaceholder();
  bindEvents();
  applyInitialSidebarLayout();
  renderChat();
  renderEmptyRecordings();
  resetTimer();
  resetLiveTranscript();
  updatePlaybackControls();
  renderModelStatus();
}

function applyInitialSidebarLayout() {
  const waitForLoad =
    document.readyState === "complete"
      ? Promise.resolve()
      : new Promise((resolve) => {
          window.addEventListener("load", resolve, { once: true });
        });

  const waitForFonts = document.fonts?.ready
    ? document.fonts.ready.catch(() => undefined)
    : Promise.resolve();

  Promise.all([waitForLoad, waitForFonts]).then(() => {
    stabilizeSidebarLayout();

    requestAnimationFrame(() => {
      stabilizeSidebarLayout();
      revealPanelStage();
    });
  });
}

function stabilizeSidebarLayout() {
  showSidebarPanel("config");
  void els.panelStage.offsetHeight;
  showSidebarPanel("practice");
  void els.panelStage.offsetHeight;
}

function revealPanelStage() {
  els.panelStage.classList.remove("panel-stage-pending");
}

function migrateLegacyModelDefaults() {
  if (state.transcribeModel === "gpt-4o-mini-transcribe") {
    state.transcribeModel = DEFAULT_TRANSCRIBE_MODEL;
    localStorage.setItem("speaksprint-transcribe-model", DEFAULT_TRANSCRIBE_MODEL);
  }
}

function bindEvents() {
  els.panelMenuBtn.addEventListener("click", togglePanelMenu);
  els.practiceMenuItem.addEventListener("click", () => showSidebarPanel("practice"));
  els.configMenuItem.addEventListener("click", () => showSidebarPanel("config"));
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);
  els.topicPreset.addEventListener("change", updateTopicPlaceholder);
  els.apiKey.addEventListener("change", () => persistField("apiKey", els.apiKey.value.trim()));
  els.apiBaseUrl.addEventListener("change", () =>
    persistField("apiBaseUrl", sanitizeBaseUrl(els.apiBaseUrl.value.trim())),
  );
  els.chatModelPreset.addEventListener("change", () => updateModelControl("chat"));
  els.transcribeModelPreset.addEventListener("change", () => updateModelControl("transcribe"));
  els.ttsModelPreset.addEventListener("change", () => updateModelControl("tts"));
  els.chatModel.addEventListener("change", () => persistResolvedModel("chat"));
  els.transcribeModel.addEventListener("change", () => persistResolvedModel("transcribe"));
  els.ttsModel.addEventListener("change", () => persistResolvedModel("tts"));
  els.ttsVoice.addEventListener("change", () => persistField("ttsVoice", els.ttsVoice.value));
  els.startSessionBtn.addEventListener("click", startSession);
  els.endSessionBtn.addEventListener("click", endSessionWithReview);
  els.recordBtn.addEventListener("click", startRecording);
  els.redoBtn.addEventListener("click", redoRecording);
  els.sendBtn.addEventListener("click", sendCurrentRecording);
}

function showSidebarPanel(panel) {
  const isPractice = panel === "practice";
  setPanelVisibility(els.practicePanel, isPractice);
  setPanelVisibility(els.practicePanelSecondary, isPractice);
  setPanelVisibility(els.configPanel, !isPractice);
  setPanelVisibility(els.configPanelSecondary, !isPractice);
  els.currentPanelLabel.textContent = isPractice ? "Practice Panel" : "Basic Settings";
  els.practiceMenuItem.classList.toggle("is-active", isPractice);
  els.configMenuItem.classList.toggle("is-active", !isPractice);
  closePanelMenu();
}

function setPanelVisibility(element, visible) {
  element.classList.toggle("hidden", !visible);
  element.hidden = !visible;
  element.style.display = visible ? "" : "none";
}

function togglePanelMenu() {
  const shouldOpen = els.panelMenu.hidden;
  els.panelMenu.hidden = !shouldOpen;
  els.panelMenu.classList.toggle("hidden", !shouldOpen);
  els.panelMenuBtn.setAttribute("aria-expanded", String(shouldOpen));
}

function closePanelMenu() {
  els.panelMenu.hidden = true;
  els.panelMenu.classList.add("hidden");
  els.panelMenuBtn.setAttribute("aria-expanded", "false");
}

function handleDocumentClick(event) {
  if (
    els.panelMenu.hidden ||
    els.panelMenu.contains(event.target) ||
    els.panelMenuBtn.contains(event.target)
  ) {
    return;
  }
  closePanelMenu();
}

function handleDocumentKeydown(event) {
  if (event.key === "Escape") {
    closePanelMenu();
  }
}

function hydrateModelControl(kind) {
  const config = getModelControlConfig(kind);
  const { stateKey, presetEl, inputEl, options } = config;
  const model = state[stateKey];

  if (options.includes(model)) {
    presetEl.value = model;
    inputEl.value = model;
    inputEl.classList.add("hidden");
  } else {
    presetEl.value = "custom";
    inputEl.value = model;
    inputEl.classList.remove("hidden");
  }
}

function updateModelControl(kind) {
  const { presetEl, inputEl } = getModelControlConfig(kind);

  if (presetEl.value === "custom") {
    inputEl.classList.remove("hidden");
    inputEl.focus();
  } else {
    inputEl.value = presetEl.value;
    inputEl.classList.add("hidden");
  }

  persistResolvedModel(kind);
}

function persistResolvedModel(kind) {
  const { presetEl, inputEl, stateKey } = getModelControlConfig(kind);
  const value =
    presetEl.value === "custom" ? inputEl.value.trim() : presetEl.value.trim();

  if (!value) {
    return;
  }

  persistField(stateKey, value);
}

function getModelControlConfig(kind) {
  if (kind === "chat") {
    return {
      stateKey: "chatModel",
      presetEl: els.chatModelPreset,
      inputEl: els.chatModel,
      options: CHAT_MODEL_OPTIONS,
    };
  }

  if (kind === "transcribe") {
    return {
      stateKey: "transcribeModel",
      presetEl: els.transcribeModelPreset,
      inputEl: els.transcribeModel,
      options: TRANSCRIBE_MODEL_OPTIONS,
    };
  }

  return {
    stateKey: "ttsModel",
    presetEl: els.ttsModelPreset,
    inputEl: els.ttsModel,
    options: TTS_MODEL_OPTIONS,
  };
}

function initSpeechRecognitionSupport() {
  const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.speechRecognitionSupported = Boolean(RecognitionClass);
  if (!state.speechRecognitionSupported) {
    setCaptionStatus("当前浏览器不支持实时识别");
  }
}

function persistField(field, value) {
  state[field] = value;
  const keyMap = {
    apiKey: "speaksprint-api-key",
    apiBaseUrl: "speaksprint-api-base-url",
    chatModel: "speaksprint-chat-model",
    transcribeModel: "speaksprint-transcribe-model",
    ttsModel: "speaksprint-tts-model",
    ttsVoice: "speaksprint-tts-voice",
  };
  localStorage.setItem(keyMap[field], value);

  if (["apiKey", "apiBaseUrl", "chatModel", "transcribeModel", "ttsModel", "ttsVoice"].includes(field)) {
    resetModelStatus();
  }
}

function updateTopicPlaceholder() {
  const preset = els.topicPreset.value;
  const hint = topicPresets[preset];
  els.customTopic.disabled = preset !== "custom";
  if (preset !== "custom" && !els.customTopic.value.trim()) {
    els.customTopic.value = hint;
  }
  if (preset === "custom") {
    els.customTopic.value = "";
  }
}

async function startSession() {
  const apiKey = els.apiKey.value.trim();
  if (!apiKey) {
    showToast("请先填写可用的 API Key。");
    return;
  }

  const apiBaseUrl = sanitizeBaseUrl(els.apiBaseUrl.value.trim());
  if (!apiBaseUrl) {
    showToast("请先填写可用的 API Base URL。");
    return;
  }

  persistField("apiKey", apiKey);
  persistField("apiBaseUrl", apiBaseUrl);
  persistResolvedModel("chat");
  persistResolvedModel("transcribe");
  persistResolvedModel("tts");
  persistField("ttsVoice", els.ttsVoice.value);

  const topic = resolveTopic();
  if (!topic) {
    showToast("请先选择或填写练习主题。");
    return;
  }

  const sessionToken = resetSessionForRestart(topic);

  state.conversation = [];
  state.turnCount = 0;
  renderChat();
  setSessionUI(true);
  appendSystemNotice(`本轮主题：${topic}`);

  try {
    setBusy(els.startSessionBtn, true, "AI 准备中...");
    const opener = await createOpeningMessage(topic, els.level.value);
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    const openerMessage = appendMessage("assistant", opener);
    playAssistantSpeech(opener, openerMessage.id);
    unlockRecording();
  } catch (error) {
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    state.sessionActive = false;
    setSessionUI(false);
    appendSystemNotice(`启动失败：${error.message}`);
  } finally {
    setBusy(els.startSessionBtn, false, "开始练习");
    els.startSessionBtn.disabled = false;
  }
}

async function endSessionWithReview() {
  if (!state.sessionActive) {
    return;
  }

  const sessionToken = state.activeSessionToken;

  try {
    setBusy(els.endSessionBtn, true, "总结中...");
    disableRecordingControls();
    stopLiveSpeechRecognition();
    const review = await createSessionReview();
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    const reviewMessage = appendMessage("assistant", review);
    playAssistantSpeech(review, reviewMessage.id);
    state.sessionActive = false;
    setSessionUI(false);
  } catch (error) {
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    appendSystemNotice(`总结失败：${error.message}`);
    unlockRecording();
  } finally {
    setBusy(els.endSessionBtn, false, "结束总结");
    els.endSessionBtn.disabled = !state.sessionActive;
  }
}

function resolveTopic() {
  const preset = els.topicPreset.value;
  if (preset === "custom") {
    return els.customTopic.value.trim();
  }
  return topicPresets[preset];
}

function setSessionUI(active) {
  els.sessionBadge.textContent = active ? "练习中" : "未开始";
  els.sessionBadge.className = `status-pill ${active ? "success" : "idle"}`;
  els.endSessionBtn.disabled = !active;
  els.startSessionBtn.disabled = false;
  if (!active) {
    disableRecordingControls();
    setRecordState("等待开始", "idle");
    resetLiveTranscript();
  }
}

function resetSessionForRestart(topic) {
  state.activeSessionToken += 1;
  state.practiceTopic = topic;
  state.sessionActive = true;
  state.turnCount = 0;
  state.currentBlob = null;
  state.isRecordingPaused = false;
  state.remainingRecordingMs = MAX_RECORDING_MS;
  stopCurrentPlayback();
  if (state.isRecording) {
    state.isRecording = false;
  }
  clearInterval(state.countdownInterval);
  state.countdownInterval = null;
  stopLiveSpeechRecognition();
  teardownAudioNodes();
  clearDraftPlayer();
  clearRecordings();
  resetTimer();
  resetLiveTranscript();
  return state.activeSessionToken;
}

async function startRecording() {
  if (!state.sessionActive) {
    return;
  }

  try {
    if (!state.mediaStream) {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!state.isRecording && !state.isRecordingPaused) {
      stopCurrentPlayback();
      teardownAudioNodes();
      state.pcmChunks = [];
      state.currentBlob = null;
      state.remainingRecordingMs = MAX_RECORDING_MS;
      clearDraftPlayer();
      resetLiveTranscript();
      await setupWavRecorder();
      startLiveSpeechRecognition();
      state.isRecording = true;
      state.isRecordingPaused = false;
      state.recordingStartAt = Date.now();
      state.countdownEndAt = Date.now() + state.remainingRecordingMs;
      state.countdownInterval = window.setInterval(updateCountdown, 250);
      updateCountdown();

      els.recordBtn.disabled = false;
      els.recordBtn.textContent = "暂停录音";
      els.redoBtn.disabled = false;
      els.sendBtn.disabled = false;
      setRecordState("录音中", "recording");
      return;
    }

    if (state.isRecording) {
      pauseRecording();
      return;
    }

    if (state.isRecordingPaused) {
      resumeRecording();
    }
  } catch (error) {
    appendSystemNotice(`无法访问麦克风：${error.message}`);
  }
}

function stopRecording() {
  if (!state.isRecording && !state.isRecordingPaused) {
    return;
  }
  state.isRecording = false;
  state.isRecordingPaused = false;
  stopLiveSpeechRecognition();
  finalizeRecording();
}

function redoRecording() {
  if (!state.sessionActive) {
    return;
  }

  state.isRecording = false;
  state.isRecordingPaused = false;
  clearInterval(state.countdownInterval);
  state.countdownInterval = null;
  stopLiveSpeechRecognition();
  teardownAudioNodes();
  state.pcmChunks = [];
  state.remainingRecordingMs = MAX_RECORDING_MS;
  clearDraftPlayer();
  resetTimer();
  resetLiveTranscript();
  unlockRecording();
}

function pauseRecording() {
  if (!state.isRecording) {
    return;
  }

  state.remainingRecordingMs = Math.max(0, state.countdownEndAt - Date.now());
  state.isRecording = false;
  state.isRecordingPaused = true;
  stopLiveSpeechRecognition();
  clearInterval(state.countdownInterval);
  state.countdownInterval = null;
  els.recordBtn.textContent = "继续录音";
  els.redoBtn.disabled = false;
  els.sendBtn.disabled = false;
  setRecordState("录音已暂停", "idle");
}

function resumeRecording() {
  if (!state.isRecordingPaused) {
    return;
  }

  state.isRecording = true;
  state.isRecordingPaused = false;
  startLiveSpeechRecognition();
  state.recordingStartAt = Date.now();
  state.countdownEndAt = Date.now() + state.remainingRecordingMs;
  state.countdownInterval = window.setInterval(updateCountdown, 250);
  updateCountdown();
  els.recordBtn.textContent = "暂停录音";
  els.redoBtn.disabled = false;
  els.sendBtn.disabled = false;
  setRecordState("录音中", "recording");
}

function finalizeRecording() {
  clearInterval(state.countdownInterval);
  state.countdownInterval = null;
  state.remainingRecordingMs = MAX_RECORDING_MS;
  resetTimer();

  if (!state.pcmChunks.length) {
    appendSystemNotice("没有采集到有效音频，请重试一次。");
    teardownAudioNodes();
    unlockRecording();
    return;
  }

  state.currentBlob = encodeWavFromPcm(state.pcmChunks, state.sampleRate);
  teardownAudioNodes();
  state.currentBlobUrl = URL.createObjectURL(state.currentBlob);
  els.draftPlayer.src = state.currentBlobUrl;
  els.draftPlayer.classList.remove("hidden");
  els.sendBtn.disabled = false;
  els.recordBtn.disabled = false;
  els.redoBtn.disabled = false;
  els.recordBtn.textContent = "继续录音";
  setRecordState("录音已完成", "success");
}

function updateCountdown() {
  const remaining = Math.max(0, state.countdownEndAt - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  els.timerLabel.textContent = `${seconds}s`;
  if (remaining <= 0) {
    stopRecording();
  }
}

function resetTimer() {
  els.timerLabel.textContent = "90s";
}

async function sendCurrentRecording() {
  if (!state.sessionActive) {
    return;
  }

  const sessionToken = state.activeSessionToken;

  try {
    setBusy(els.sendBtn, true, "分析中...");
    disableRecordingControls();

    if ((state.isRecording || state.isRecordingPaused) && state.pcmChunks.length) {
      state.isRecording = false;
      state.isRecordingPaused = false;
      stopLiveSpeechRecognition();
      finalizeRecording();
    }

    if (!state.currentBlob) {
      appendSystemNotice("请先录制一点语音，再发送。");
      unlockRecording();
      return;
    }

    const transcript = await transcribeAudio(state.currentBlob);
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    state.liveTranscriptFinal = transcript;
    state.liveTranscriptInterim = "";
    renderLiveTranscript();
    setCaptionStatus("已同步最终转写");
    const userMessage = appendMessage("user", transcript);

    const analysis = await analyzeTurn(transcript);
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    const savedRecording = await saveRecording({
      createdAt: new Date().toISOString(),
      transcript,
      blob: state.currentBlob,
      scores: analysis.scores,
      feedback: analysis.feedback,
      correction: analysis.correction,
      polished: analysis.polished,
    });
    userMessage.recordingBlob = savedRecording.blob;
    renderChat();

    renderRecording(savedRecording);
    clearDraftPlayer();
    const replyMessage = appendMessage("assistant", analysis.assistantReply);
    playAssistantSpeech(analysis.assistantReply, replyMessage.id);

    if (analysis.shouldEnd) {
      state.sessionActive = false;
      setSessionUI(false);
      appendSystemNotice("AI 认为这轮练习已经自然完成，你也可以重新开始新主题。");
      if (analysis.sessionReview) {
        const sessionReviewMessage = appendMessage("assistant", analysis.sessionReview);
        playAssistantSpeech(analysis.sessionReview, sessionReviewMessage.id);
      }
      return;
    }

    unlockRecording();
  } catch (error) {
    if (sessionToken !== state.activeSessionToken) {
      return;
    }
    appendSystemNotice(`发送失败：${error.message}`);
    unlockRecording();
  } finally {
    setBusy(els.sendBtn, false, "发送录音");
    els.sendBtn.disabled = !state.sessionActive || !state.currentBlob;
  }
}

function unlockRecording() {
  if (!state.sessionActive) {
    return;
  }
  state.isRecording = false;
  state.isRecordingPaused = false;
  els.recordBtn.disabled = false;
  els.redoBtn.disabled = !hasRecordingDraft();
  els.recordBtn.textContent = state.currentBlob ? "继续录音" : "开始录音";
  els.sendBtn.disabled = false;
  setRecordState("可开始录音", "success");
}

function disableRecordingControls() {
  els.recordBtn.disabled = true;
  els.redoBtn.disabled = true;
  els.sendBtn.disabled = true;
}

function setRecordState(text, status) {
  els.recordIndicator.textContent = text;
  els.recordIndicator.className = `status-pill ${status}`;
}

function clearDraftPlayer() {
  if (state.currentBlobUrl) {
    URL.revokeObjectURL(state.currentBlobUrl);
  }
  state.currentBlob = null;
  state.currentBlobUrl = "";
  els.draftPlayer.removeAttribute("src");
  els.draftPlayer.classList.add("hidden");
}

function hasRecordingDraft() {
  return Boolean(state.currentBlob || state.pcmChunks.length || state.isRecording || state.isRecordingPaused);
}

function resetLiveTranscript() {
  state.liveTranscriptFinal = "";
  state.liveTranscriptInterim = "";
  els.liveTranscript.textContent = "开始录音后，这里会尽量实时显示你正在说的话。";
  els.liveTranscript.classList.add("empty");
  setCaptionStatus(
    state.speechRecognitionSupported ? "待命中" : "当前浏览器不支持实时识别",
  );
}

function renderLiveTranscript() {
  const combined = [state.liveTranscriptFinal.trim(), state.liveTranscriptInterim.trim()]
    .filter(Boolean)
    .join(" ");

  if (!combined) {
    els.liveTranscript.textContent = "正在听你说话...";
    els.liveTranscript.classList.remove("empty");
    return;
  }

  els.liveTranscript.textContent = combined;
  els.liveTranscript.classList.remove("empty");
}

function setCaptionStatus(text) {
  els.captionStatus.textContent = text;
}

function resetModelStatus() {
  state.modelStatus = {
    chat: { state: "pending", label: "未验证" },
    transcribe: { state: "pending", label: "未验证" },
    tts: { state: "pending", label: "未验证" },
  };
  renderModelStatus();
}

function updateModelStatus(kind, status, label) {
  state.modelStatus[kind] = { state: status, label };
  renderModelStatus();
}

function renderModelStatus() {
  applyModelStatus(els.chatModelStatus, state.modelStatus.chat);
  applyModelStatus(els.transcribeModelStatus, state.modelStatus.transcribe);
  applyModelStatus(els.ttsModelStatus, state.modelStatus.tts);
  els.modelStatusNote.textContent =
    `对话：${state.chatModel} | 转写：${state.transcribeModel} | 语音：${state.ttsModel} / ${state.ttsVoice}`;
}

function applyModelStatus(element, status) {
  element.textContent = status.label;
  element.className = `mini-status ${status.state}`;
}

function appendMessage(role, text) {
  const message = {
    id: createMessageId(role),
    role,
    text,
    followUps: [],
    recordingBlob: null,
    composer: null,
  };
  state.conversation.push(message);
  renderChat();
  return message;
}

function createMessageId(role) {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${role}-${Date.now()}-${randomPart}`;
}

function appendSystemNotice(text) {
  const node = document.createElement("p");
  node.className = "system-note";
  node.textContent = text;
  els.chatLog.appendChild(node);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderChat() {
  els.chatLog.innerHTML = "";
  if (!state.conversation.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "开始练习后，AI 会先发起对话。";
    els.chatLog.appendChild(empty);
    return;
  }

  state.conversation.forEach((item, index) => {
    const fragment = els.messageTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".message");
    card.classList.add(item.role);
    if (item.id && item.id === state.currentPlaybackMessageId) {
      card.classList.add("playing");
    }
    const meta = fragment.querySelector(".message-meta");
    meta.textContent = item.role === "assistant" ? `AI · 第 ${index + 1} 句` : `你 · 第 ${index + 1} 句`;
    const body = fragment.querySelector(".message-body");
    body.textContent = item.text;

    const actionRow = document.createElement("div");
    actionRow.className = "message-action-row";

    const askButton = document.createElement("button");
    askButton.type = "button";
    askButton.className = "ghost-btn message-replay-btn";
    askButton.textContent = "继续追问";
    askButton.addEventListener("click", () => openMessageComposer(item.id, null));
    actionRow.appendChild(askButton);

    const replayButton = document.createElement("button");
    replayButton.type = "button";
    replayButton.className = "ghost-btn message-replay-btn";
    replayButton.textContent = "重播";
    replayButton.addEventListener("click", () => replayMessage(item));

    const pauseButton = document.createElement("button");
    pauseButton.type = "button";
    pauseButton.className = "ghost-btn message-replay-btn";
    pauseButton.textContent =
      item.id === state.currentPlaybackMessageId && state.isPlaybackPaused ? "继续" : "暂停";
    pauseButton.disabled = item.id !== state.currentPlaybackMessageId || !state.currentPlaybackMode;
    pauseButton.addEventListener("click", () => togglePlaybackPause());

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.className = "ghost-btn message-replay-btn";
    stopButton.textContent = "停止";
    stopButton.disabled = item.id !== state.currentPlaybackMessageId || !state.currentPlaybackMode;
    stopButton.addEventListener("click", () => stopCurrentPlayback());

    actionRow.prepend(replayButton, pauseButton, stopButton);
    card.appendChild(actionRow);
    if (item.followUps?.length) {
      card.appendChild(
        renderFollowUpTree(item.followUps, {
          onAsk: async (thread, turn) => openMessageComposer(item.id, `${thread.id}:${turn.id}`),
        }),
      );
    }
    if (item.composer) {
      card.appendChild(
        renderInlineComposer({
          value: item.composer.draft,
          onInput: (value) => updateMessageComposerDraft(item.id, value),
          onCancel: () => closeMessageComposer(item.id),
          onSubmit: () => submitMessageFollowUp(item.id),
        }),
      );
    }
    els.chatLog.appendChild(fragment);
  });

  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function clearRecordings() {
  els.recordingsList.innerHTML = "";
  renderEmptyRecordings();
}

function renderEmptyRecordings() {
  els.recordingsList.innerHTML = "发送语音后，这里会保存你的录音和对应反馈。";
  els.recordingsList.classList.add("empty-state");
}

function renderRecording(recording) {
  if (els.recordingsList.classList.contains("empty-state")) {
    els.recordingsList.innerHTML = "";
    els.recordingsList.classList.remove("empty-state");
  }

  const fragment = els.recordingTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".recording-item");
  const details = fragment.querySelector(".recording-details");
  const feedbackStack = fragment.querySelector(".feedback-stack");
  const title = fragment.querySelector("h3");
  const collapseBtn = fragment.querySelector(".collapse-btn");

  title.textContent = `第 ${state.turnCount + 1} 次语音发送`;
  fragment.querySelector(".recording-transcript").textContent = recording.transcript;
  attachFeedback(feedbackStack, recording);
  collapseBtn.addEventListener("click", () => {
    const shouldExpand = details.classList.contains("hidden");
    details.classList.toggle("hidden", !shouldExpand);
    collapseBtn.textContent = shouldExpand ? "收起详情" : "展开详情";
  });

  els.recordingsList.prepend(card);
  state.turnCount += 1;
}

function attachFeedback(container, recording) {
  const blocks = [
    {
      key: "scores",
      title: "评分",
      content: `发音：${recording.scores.pronunciation}/10 | 语法：${recording.scores.grammar}/10 | 地道：${recording.scores.naturalness}/10 | 总分：${recording.scores.overall}/10`,
      followUps: [],
      composer: null,
    },
    {
      key: "feedback",
      title: "AI 点评",
      content: `发音：${recording.feedback.pronunciation}\n语法：${recording.feedback.grammar}\n地道：${recording.feedback.naturalness}`,
      followUps: [],
      composer: null,
    },
    {
      key: "correction",
      title: "AI 纠错",
      content: recording.correction,
      followUps: [],
      composer: null,
    },
    {
      key: "polished",
      title: "AI 润色",
      content: recording.polished,
      followUps: [],
      composer: null,
    },
  ];

  blocks.forEach((block) => {
    const panel = document.createElement("section");
    panel.className = "feedback-block";
    panel.dataset.block = block.key;
    const header = document.createElement("div");
    header.className = "feedback-header";
    const heading = document.createElement("h4");
    heading.textContent = block.title;
    header.appendChild(heading);

    if (block.key === "polished") {
      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.className = "ghost-btn feedback-play-btn";
      playButton.textContent = "播放润色句子";
      playButton.addEventListener("click", () => playAssistantSpeech(block.content));
      header.appendChild(playButton);
    }

    if (["scores", "feedback", "correction", "polished"].includes(block.key)) {
      const askButton = document.createElement("button");
      askButton.type = "button";
      askButton.className = "ghost-btn feedback-play-btn";
      askButton.textContent = "继续追问";
      askButton.addEventListener("click", () => openBlockComposer(panel, block, null));
      header.appendChild(askButton);
    }

    const pre = document.createElement("pre");
    pre.textContent = block.content;
    panel.append(header, pre);
    container.appendChild(panel);
  });
}

function openMessageComposer(messageId, parentFollowUpId = null) {
  const message = state.conversation.find((item) => item.id === messageId);
  if (!message) {
    return;
  }
  message.composer = { parentFollowUpId, draft: "" };
  renderChat();
}

function updateMessageComposerDraft(messageId, value) {
  const message = state.conversation.find((item) => item.id === messageId);
  if (!message?.composer) {
    return;
  }
  message.composer.draft = value;
}

function closeMessageComposer(messageId) {
  const message = state.conversation.find((item) => item.id === messageId);
  if (!message) {
    return;
  }
  message.composer = null;
  renderChat();
}

async function submitMessageFollowUp(messageId) {
  const message = state.conversation.find((item) => item.id === messageId);
  if (!message?.composer?.draft.trim()) {
    return;
  }

  const { parentFollowUpId, draft } = message.composer;
  const question = draft.trim();
  message.composer = null;

  try {
    const insertion = createPendingFollowUpThreadEntry(message.followUps, question, parentFollowUpId);
    renderChat();

    const answer = await requestFollowUpAnswer(
      message.role === "assistant" ? "AI 回复" : "我的原话",
      message.text,
      question,
      insertion.history,
    );
    insertion.turn.answer = answer;
    insertion.turn.pending = false;
    renderChat();
  } catch (error) {
    appendSystemNotice(`追问失败：${error.message}`);
  }
}

function openBlockComposer(panel, block, parentFollowUpId = null) {
  block.composer = { parentFollowUpId, draft: "" };
  renderBlockFollowUps(panel, block);
}

async function submitBlockFollowUp(panel, block) {
  if (!block.composer?.draft.trim()) {
    return;
  }

  const { parentFollowUpId, draft } = block.composer;
  const question = draft.trim();
  block.composer = null;

  try {
    const insertion = createPendingFollowUpThreadEntry(block.followUps, question, parentFollowUpId);
    renderBlockFollowUps(panel, block);

    const answer = await requestFollowUpAnswer(
      block.title,
      block.content,
      question,
      insertion.history,
    );
    insertion.turn.answer = answer;
    insertion.turn.pending = false;
    renderBlockFollowUps(panel, block);
  } catch (error) {
    appendSystemNotice(`追问失败：${error.message}`);
  }
}

function renderBlockFollowUps(panel, block) {
  panel.querySelector(".follow-up-stack")?.remove();
  panel.querySelector(".follow-up-composer")?.remove();
  if (!block.followUps.length) {
    if (block.composer) {
      panel.appendChild(
        renderInlineComposer({
          value: block.composer.draft,
          onInput: (value) => {
            block.composer.draft = value;
          },
          onCancel: () => {
            block.composer = null;
            renderBlockFollowUps(panel, block);
          },
          onSubmit: () => submitBlockFollowUp(panel, block),
        }),
      );
    }
    return;
  }
  panel.appendChild(
    renderFollowUpTree(block.followUps, {
      onAsk: async (thread, turn) => openBlockComposer(panel, block, `${thread.id}:${turn.id}`),
    }),
  );
  if (block.composer) {
    panel.appendChild(
      renderInlineComposer({
        value: block.composer.draft,
        onInput: (value) => {
          block.composer.draft = value;
        },
        onCancel: () => {
          block.composer = null;
          renderBlockFollowUps(panel, block);
        },
        onSubmit: () => submitBlockFollowUp(panel, block),
      }),
    );
  }
}

async function requestFollowUpAnswer(sourceType, sourceText, question, history = []) {
  const prompt = [
    "你是一位英语口语老师，请根据给定内容回答后续追问。",
    `当前练习主题：${state.practiceTopic || "未设定"}`,
    `追问对象类型：${sourceType}`,
    `原始内容：${sourceText}`,
    history.length
      ? `这条内容下面已有的追问上下文：\n${history
          .map(
            (item, index) =>
              `${index + 1}. 问：${item.question}\n答：${item.answer}`,
          )
          .join("\n\n")}`
      : "这条内容下面还没有历史追问。",
    `用户追问：${question}`,
    "请用中文回答，必要时给出英文例句。回答要直接、清楚、适合英语学习场景。",
  ].join("\n\n");

  return requestTextCompletion(prompt);
}

function createPendingFollowUpThreadEntry(threads, question, anchor = null) {
  if (!anchor) {
    const thread = createFollowUpThread(null, null, [createFollowUpTurn(question)]);
    threads.push(thread);
    return { thread, turn: thread.turns[0], history: [] };
  }

  const [threadId, turnId] = anchor.split(":");
  const thread = findFollowUpThread(threads, threadId);
  const targetTurn = thread?.turns.find((turn) => turn.id === turnId);
  if (!thread || !targetTurn) {
    const fallbackThread = createFollowUpThread(null, null, [createFollowUpTurn(question)]);
    threads.push(fallbackThread);
    return { thread: fallbackThread, turn: fallbackThread.turns[0], history: [] };
  }

  const history = collectThreadHistory(thread, turnId);
  const latestTurn = thread.turns[thread.turns.length - 1];

  if (latestTurn.id === turnId) {
    const turn = createFollowUpTurn(question);
    thread.turns.push(turn);
    return { thread, turn, history };
  }

  const childThread = createFollowUpThread(thread, turnId, [createFollowUpTurn(question)]);
  thread.children.push(childThread);
  return { thread: childThread, turn: childThread.turns[0], history };
}

function createFollowUpThread(parent = null, parentTurnId = null, turns = []) {
  return {
    id: createMessageId("followup-thread"),
    parent,
    parentTurnId,
    turns,
    children: [],
  };
}

function createFollowUpTurn(question, answer = "", pending = true) {
  return {
    id: createMessageId("followup-turn"),
    question,
    answer,
    pending,
  };
}

function renderFollowUpTree(threads, options, depth = 0) {
  const stack = document.createElement("div");
  stack.className = "follow-up-stack";
  if (depth > 0) {
    stack.dataset.depth = String(depth);
  }

  threads.forEach((thread, index) => {
    const block = document.createElement("section");
    block.className = "follow-up-block";
    if (depth > 0) {
      block.classList.add("nested");
    }

    const title = document.createElement("h5");
    title.textContent = `追问 ${index + 1}`;

    block.appendChild(title);

    thread.turns.forEach((turn, turnIndex) => {
      const turnGroup = document.createElement("div");
      turnGroup.className = "follow-up-turn";

      const questionLine = document.createElement("p");
      questionLine.className = "follow-up-question";
      questionLine.textContent = `你：${turn.question}`;

      const answerLine = document.createElement("p");
      answerLine.className = turn.pending ? "follow-up-answer pending" : "follow-up-answer";
      answerLine.textContent = turn.pending ? "AI：思考中..." : `AI：${turn.answer}`;

      const actionRow = document.createElement("div");
      actionRow.className = "follow-up-action-row";
      const askButton = document.createElement("button");
      askButton.type = "button";
      askButton.className = "ghost-btn message-replay-btn";
      askButton.textContent =
        turnIndex === thread.turns.length - 1 ? "继续追问这条回答" : "从这里分支追问";
      askButton.disabled = turn.pending;
      askButton.addEventListener("click", async () => {
        await options.onAsk(thread, turn);
      });
      actionRow.appendChild(askButton);

      turnGroup.append(questionLine, answerLine, actionRow);
      block.appendChild(turnGroup);
    });

    if (thread.children?.length) {
      block.appendChild(renderFollowUpTree(thread.children, options, depth + 1));
    }

    stack.appendChild(block);
  });

  return stack;
}

function findFollowUpThread(threads, targetId) {
  for (const thread of threads) {
    if (thread.id === targetId) {
      return thread;
    }
    const child = findFollowUpThread(thread.children || [], targetId);
    if (child) {
      return child;
    }
  }
  return null;
}

function collectThreadHistory(thread, turnId) {
  const lineage = [];
  const parentHistory = thread.parent ? collectThreadHistory(thread.parent, thread.parentTurnId) : [];
  lineage.push(...parentHistory);

  for (const turn of thread.turns) {
    if (!turn.pending) {
      lineage.push({ question: turn.question, answer: turn.answer });
    }
    if (turn.id === turnId) {
      break;
    }
  }

  return lineage;
}

function renderInlineComposer(options) {
  const composer = document.createElement("div");
  composer.className = "follow-up-composer";

  const label = document.createElement("p");
  label.className = "follow-up-composer-label";
  label.textContent = "在这里继续追问这条内容";

  const input = document.createElement("textarea");
  input.rows = 2;
  input.placeholder = "直接在这里输入追问...";
  input.value = options.value || "";
  input.addEventListener("input", (event) => {
    options.onInput(event.target.value);
  });
  input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      options.onSubmit();
    }
  });

  const actionRow = document.createElement("div");
  actionRow.className = "follow-up-action-row";

  const sendButton = document.createElement("button");
  sendButton.type = "button";
  sendButton.className = "primary-btn";
  sendButton.textContent = "发送追问";
  sendButton.addEventListener("click", options.onSubmit);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ghost-btn";
  cancelButton.textContent = "取消";
  cancelButton.addEventListener("click", options.onCancel);

  actionRow.append(sendButton, cancelButton);
  composer.append(label, input, actionRow);
  requestAnimationFrame(() => input.focus());
  return composer;
}

async function createOpeningMessage(topic, level) {
  const prompt = [
    "你是一位英语口语陪练老师，需要先主动发起对话。",
    `当前主题：${topic}`,
    `学习者水平：${level}`,
    "请直接用英语说 3 到 5 句，语气自然，先开场，再提出一个明确问题，并引导对方继续聊。",
    "不要输出中文，不要使用列表。",
  ].join("\n");
  return requestTextCompletion(prompt);
}

async function analyzeTurn(transcript) {
  const prompt = [
    "你是一位英语口语教练。",
    `练习主题：${state.practiceTopic}`,
    `学习者水平：${els.level.value}`,
    "下面是最近的对话历史，请理解语境并继续对话。",
    formatConversationForPrompt(),
    `学习者刚刚的英文回复：${transcript}`,
    "请返回 JSON，不要加 markdown 代码块。",
    "JSON 格式：",
    JSON.stringify(
      {
        assistantReply: "继续对话的英文回复，2到4句，必须自然并引导用户继续说",
        shouldEnd: false,
        sessionReview: "若 shouldEnd 为 true，则给出本轮英语总结，否则返回空字符串",
        scores: {
          pronunciation: 7,
          grammar: 8,
          naturalness: 7,
          overall: 7,
        },
        feedback: {
          pronunciation: "重点指出发音问题；如果仅能根据转写做估计，也要明确写出。",
          grammar: "指出语法优缺点。",
          naturalness: "指出是否地道并给建议。",
        },
        correction: "给出更正确的英文表达，并简要解释哪里错了。",
        polished: "给出更自然、更像母语者的英文说法。",
      },
      null,
      2,
    ),
    "要求：评分使用 1 到 10 的整数；assistantReply 必须是英文，其余字段用中文。",
    "如果对话自然结束，可以将 shouldEnd 设为 true。",
  ].join("\n\n");

  const text = await requestTextCompletion(prompt);
  return parseJson(text);
}

async function createSessionReview() {
  const prompt = [
    "你是一位英语口语老师，请对本轮练习做总结。",
    `练习主题：${state.practiceTopic}`,
    formatConversationForPrompt(),
    "请用中文输出一个简洁总结，包含：整体表现、最需要提升的一点、下一轮建议、一个鼓励句子。",
  ].join("\n\n");
  return requestTextCompletion(prompt);
}

function formatConversationForPrompt() {
  if (!state.conversation.length) {
    return "当前还没有历史对话。";
  }

  return state.conversation
    .map((item, index) => `${index + 1}. ${item.role === "assistant" ? "AI" : "User"}: ${item.text}`)
    .join("\n");
}

async function transcribeAudio(blob) {
  const formData = new FormData();
  formData.append("file", blob, `practice-${Date.now()}.wav`);
  formData.append("model", state.transcribeModel);
  formData.append("language", "en");

  const response = await fetch(`${state.apiBaseUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await extractError(response);
    updateModelStatus("transcribe", "failed", "失败");
    if (/model not found/i.test(message)) {
      throw new Error(
        `当前转写模型不可用：${state.transcribeModel}。请改用 whisper-1 或你的网关支持的转写模型。`,
      );
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!data.text) {
    updateModelStatus("transcribe", "failed", "失败");
    throw new Error("转写结果为空，请重试。");
  }
  updateModelStatus("transcribe", "connected", "已连接");
  return data.text.trim();
}

function startLiveSpeechRecognition() {
  if (!state.speechRecognitionSupported) {
    return;
  }

  stopLiveSpeechRecognition();
  const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new RecognitionClass();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    setCaptionStatus("实时识别中");
  };

  recognition.onresult = (event) => {
    let finalText = state.liveTranscriptFinal;
    let interimText = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript?.trim() || "";
      if (!transcript) {
        continue;
      }
      if (result.isFinal) {
        finalText = `${finalText} ${transcript}`.trim();
      } else {
        interimText = `${interimText} ${transcript}`.trim();
      }
    }

    state.liveTranscriptFinal = finalText;
    state.liveTranscriptInterim = interimText;
    renderLiveTranscript();
  };

  recognition.onerror = (event) => {
    setCaptionStatus(`实时识别不可用：${event.error}`);
  };

  recognition.onend = () => {
    if (state.isRecording) {
      try {
        recognition.start();
      } catch {
        setCaptionStatus("实时识别已暂停");
      }
    } else if (state.liveTranscriptFinal || state.liveTranscriptInterim) {
      setCaptionStatus("实时识别已结束");
    } else {
      setCaptionStatus("待命中");
    }
  };

  state.speechRecognition = recognition;

  try {
    recognition.start();
  } catch {
    setCaptionStatus("实时识别启动失败");
  }
}

function stopLiveSpeechRecognition() {
  if (!state.speechRecognition) {
    return;
  }

  const recognition = state.speechRecognition;
  state.speechRecognition = null;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.stop();
  } catch {
    // Ignore stop errors from already-closed recognizers.
  }

  if (state.liveTranscriptFinal || state.liveTranscriptInterim) {
    setCaptionStatus("实时识别已结束");
  } else {
    setCaptionStatus(state.speechRecognitionSupported ? "待命中" : "当前浏览器不支持实时识别");
  }
}

async function setupWavRecorder() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("当前浏览器不支持 Web Audio 录音。");
  }

  state.audioContext = new AudioContextClass({ sampleRate: state.sampleRate });
  await state.audioContext.resume();
  state.sampleRate = state.audioContext.sampleRate;
  state.sourceNode = state.audioContext.createMediaStreamSource(state.mediaStream);

  // ScriptProcessorNode is deprecated but still broadly supported and simple for a static site.
  state.processorNode = state.audioContext.createScriptProcessor(4096, 1, 1);
  state.processorNode.onaudioprocess = (event) => {
    if (!state.isRecording) {
      return;
    }
    const inputChannel = event.inputBuffer.getChannelData(0);
    state.pcmChunks.push(new Float32Array(inputChannel));
  };

  state.sourceNode.connect(state.processorNode);
  state.processorNode.connect(state.audioContext.destination);
}

function teardownAudioNodes() {
  if (state.processorNode) {
    state.processorNode.disconnect();
    state.processorNode.onaudioprocess = null;
    state.processorNode = null;
  }

  if (state.sourceNode) {
    state.sourceNode.disconnect();
    state.sourceNode = null;
  }

  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
}

function encodeWavFromPcm(chunks, sampleRate) {
  const merged = mergeFloat32Chunks(chunks);
  const pcm16 = convertFloat32ToInt16(merged);
  const header = createWavHeader(pcm16.length * 2, sampleRate, 1, 16);
  return new Blob([header, pcm16.buffer], { type: "audio/wav" });
}

function mergeFloat32Chunks(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;

  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });

  return merged;
}

function convertFloat32ToInt16(float32Data) {
  const int16 = new Int16Array(float32Data.length);
  for (let index = 0; index < float32Data.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Data[index]));
    int16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16;
}

function createWavHeader(dataSize, sampleRate, channels, bitsPerSample) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return buffer;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

async function requestTextCompletion(prompt) {
  const response = await fetch(`${state.apiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: JSON.stringify({
      model: state.chatModel,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are a warm English speaking coach. Follow the user's requested format exactly.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await extractError(response);
    updateModelStatus("chat", "failed", "失败");
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    updateModelStatus("chat", "failed", "失败");
    throw new Error("AI 返回为空，请重试。");
  }
  updateModelStatus("chat", "connected", "已连接");
  return text;
}

async function extractError(response) {
  try {
    const data = await response.json();
    return data.error?.message || "请求失败。";
  } catch {
    return `请求失败，状态码 ${response.status}`;
  }
}

function parseJson(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI 返回的分析结果不是合法 JSON，请稍后重试。");
  }
}

async function playAssistantSpeech(text, messageId = "") {
  try {
    await playTtsAudio(text, messageId);
  } catch (error) {
    appendSystemNotice(`官方语音播放失败，已回退到浏览器朗读：${error.message}`);
    fallbackSpeakText(text, messageId);
  }
}

async function playTtsAudio(text, messageId = "") {
  if (!state.apiKey) {
    throw new Error("缺少 API Key。");
  }

  const response = await fetch(`${state.apiBaseUrl}/v1/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: JSON.stringify({
      model: state.ttsModel,
      voice: state.ttsVoice,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const message = await extractError(response);
    updateModelStatus("tts", "failed", "失败");
    throw new Error(message);
  }

  const blob = await response.blob();
  updateModelStatus("tts", "connected", "已连接");
  await playAudioBlob(blob, messageId);
}

function playAudioBlob(blob, messageId = "") {
  return new Promise((resolve, reject) => {
    stopCurrentPlayback();
    state.currentPlaybackUrl = URL.createObjectURL(blob);
    state.currentPlaybackAudio = new Audio(state.currentPlaybackUrl);
    state.currentPlaybackMode = "tts";
    state.currentPlaybackMessageId = messageId;
    state.isPlaybackPaused = false;
    updatePlaybackControls();
    state.currentPlaybackAudio.addEventListener("ended", () => {
      stopCurrentPlayback();
      resolve();
    });
    state.currentPlaybackAudio.addEventListener("error", () => {
      stopCurrentPlayback();
      reject(new Error("音频播放失败。"));
    });
    state.currentPlaybackAudio.play().catch((error) => {
      stopCurrentPlayback();
      reject(error);
    });
  });
}

function stopCurrentPlayback() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (state.currentPlaybackAudio) {
    state.currentPlaybackAudio.pause();
    state.currentPlaybackAudio.src = "";
    state.currentPlaybackAudio = null;
  }

  if (state.currentPlaybackUrl) {
    URL.revokeObjectURL(state.currentPlaybackUrl);
    state.currentPlaybackUrl = "";
  }

  state.currentPlaybackMode = "";
  state.currentPlaybackMessageId = "";
  state.isPlaybackPaused = false;
  updatePlaybackControls();
}

function fallbackSpeakText(text, messageId = "") {
  if (!("speechSynthesis" in window)) {
    return;
  }

  stopCurrentPlayback();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.98;
  utterance.pitch = 1.02;
  utterance.onstart = () => {
    state.currentPlaybackMode = "fallback";
    state.currentPlaybackMessageId = messageId;
    state.isPlaybackPaused = false;
    updatePlaybackControls();
  };
  utterance.onend = () => {
    stopCurrentPlayback();
  };
  utterance.onerror = () => {
    stopCurrentPlayback();
  };
  window.speechSynthesis.speak(utterance);
}

function togglePlaybackPause() {
  if (!state.currentPlaybackMode) {
    return;
  }

  if (state.currentPlaybackAudio) {
    if (state.currentPlaybackAudio.paused) {
      state.currentPlaybackAudio.play();
      state.isPlaybackPaused = false;
    } else {
      state.currentPlaybackAudio.pause();
      state.isPlaybackPaused = true;
    }
    updatePlaybackControls();
    return;
  }

  if (state.currentPlaybackMode === "fallback" && "speechSynthesis" in window) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      state.isPlaybackPaused = false;
    } else {
      window.speechSynthesis.pause();
      state.isPlaybackPaused = true;
    }
    updatePlaybackControls();
  }
}

function updatePlaybackControls() {
  renderChat();
}

function replayMessage(item) {
  if (item.role === "user" && item.recordingBlob) {
    playAudioBlob(item.recordingBlob, item.id);
    return;
  }

  playAssistantSpeech(item.text, item.id);
}

function sanitizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function setBusy(button, busy, label) {
  button.dataset.originalLabel ||= button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

function showToast(message) {
  appendSystemNotice(message);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDING_STORE)) {
        db.createObjectStore(RECORDING_STORE, { keyPath: "id", autoIncrement: true });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function saveRecording(recording) {
  const db = await openDb();
  const payload = { ...recording };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDING_STORE, "readwrite");
    const store = transaction.objectStore(RECORDING_STORE);
    const request = store.add(payload);

    request.addEventListener("success", () => {
      resolve({ ...payload, id: request.result });
    });
    request.addEventListener("error", () => reject(request.error));
  });
}
