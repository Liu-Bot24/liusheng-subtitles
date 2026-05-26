const UI_LOCALE_STORAGE_KEY = "fuguangUiLocale";
const DEFAULT_LOCALE = "zh";
const LOCALES = new Set(["zh", "en"]);

const I18N = {
  zh: {
    backSettings: "← 返回设置",
    asrTitle: "语音识别 API 指南",
    asrDocumentTitle: "语音识别 API 指南 - 流声字幕",
    asrLead: "语音识别 API 用来把视频声音转成原文字幕。设置完成后，回到“任务与字幕”页选择原音频语言并开始抽取。",
    onlineApi: "在线 API",
    asrOnlineIntro: "插件内置以下平台 ASR 配置档案，选择对应档案模板填入 API Key 即可直接使用。也可自行添加 Whisper 兼容接口档案，需要填写接口地址、模型名称和 API Key。",
    bailianConsole: "百炼控制台",
    groqConsole: "Groq 控制台",
    openaiPlatform: "OpenAI 平台",
    xaiConsole: "xAI 控制台",
    createApiKeySuffix: "创建 API Key。",
    bailianFunAsr: "阿里云百炼 Fun-ASR",
    bailianKeyStep: "在百炼控制台创建 API Key。",
    chooseFunAsrStep: "在插件“语音识别”里选择“Fun-ASR”。",
    groqKeyStep: "在 Groq 控制台创建 API Key。",
    chooseGroqStep: "在插件“语音识别”里选择“Groq Whisper”。",
    openaiKeyStep: "在 OpenAI 平台创建 API Key。",
    chooseOpenAiStep: "在插件“语音识别”里选择“OpenAI Whisper”。",
    xaiKeyStep: "在 xAI 控制台创建 API Key。",
    chooseXaiStep: "在插件“语音识别”里选择“xAI Grok”。",
    fillAsrKeyStep: "把 API Key 填入“API 密钥”。",
    saveSettingsStep: "保存设置。",
    funAsrPriceValue: "0.0132 元/分钟",
    funAsrPriceNote: "新用户免费额度和有效期以官方页面为准。",
    groqPriceValue: "0.00067 美元/分钟",
    groqPriceHourly: "0.04 美元/小时",
    openaiPriceValue: "0.006 美元/分钟",
    xaiPriceValue: "0.00167 美元/分钟",
    xaiPriceHourly: "0.10 美元/小时",
    priceNotice: "以上价格按 2026 年 5 月公开页面换算，可能发生变动；实际费用以各平台控制台和账单为准。",
    localDeploy: "本地部署",
    asrLocalLead: "本地 Speaches 启动后，插件接口地址填写 http://127.0.0.1:8000/v1。",
    windows: "Windows",
    mac: "Mac",
    installDocker: "安装 Docker Desktop。",
    installNvidiaDriver: "安装或更新 NVIDIA 驱动。",
    waitDocker: "打开 Docker Desktop，等待 Docker 开始运行。",
    openPowershell: "打开 PowerShell。",
    openTerminal: "打开终端。",
    runCommand: "执行下面的命令。",
    openSpeachesDocs: "浏览器打开 http://127.0.0.1:8000/docs，能看到 Speaches 页面后继续。",
    keepSpeachesRunning: "识别字幕时保持 Docker Desktop 和 speaches 容器运行。",
    pluginSettings: "插件设置",
    editing: "正在编辑",
    asrEditingValue: "选择“自定义档案”，或点击“新增档案”。",
    profileName: "档案名称",
    localSpeachesAsr: "本机 Speaches ASR",
    apiType: "接口类型",
    whisperCompatible: "Whisper 兼容接口",
    apiBaseUrl: "接口地址",
    modelName: "模型名称",
    vadFilter: "VAD 过滤",
    auto: "自动",
    apiKey: "API 密钥",
    afterSave: "保存后",
    asrAfterSaveValue: "回到“任务与字幕”，选择原音频语言，然后开始抽取。",
    notes: "注意事项",
    speachesFirstDownload: "第一次启动 Speaches 时会下载模型，等待时间会更长。",
    speachesReuseModel: "再次使用会复用已经下载的模型。",
    doNotCloseDocker: "识别时不要关闭 Docker Desktop。",
    wrongSubtitleLanguage: "字幕语种不对时，先选择正确的原音频语言，再重新 ASR。",
    copyCommand: "复制命令",
    copied: "已复制",

    llmTitle: "翻译模型配置说明",
    llmDocumentTitle: "翻译模型配置说明 - 流声字幕",
    llmLead: "翻译模型 API 用来把原文字幕翻译成目标语言。设置完成后，回到“任务与字幕”页开始抽取，或对已有原文重新翻译。",
    llmTemplatesTitle: "内置模板",
    llmTemplateIntro: "插件内置硅基流动、阿里云百炼、火山引擎和 OpenRouter 档案。选择对应模板并填入 API Key 即可使用；默认模型已填好，也可以在“模型名称”中选择或输入平台支持的模型 ID。",
    siliconflow: "硅基流动",
    bailian: "阿里云百炼",
    volcengine: "火山引擎",
    siliconflowKeyStep: "在硅基流动控制台创建 API Key。",
    bailianLlmKeyStep: "在百炼控制台创建 API Key。",
    volcengineKeyStep: "在火山引擎方舟控制台创建 API Key。",
    openrouterKeyStep: "在 OpenRouter 创建 API Key。",
    chooseSiliconflowStep: "在插件“翻译模型”里选择“硅基流动”。",
    chooseBailianLlmStep: "在插件“翻译模型”里选择“阿里云百炼”。",
    chooseVolcengineStep: "在插件“翻译模型”里选择“火山引擎”。",
    chooseOpenrouterStep: "在插件“翻译模型”里选择“OpenRouter”。",
    fillLlmKeyStep: "把 API Key 填入“API 密钥”。",
    chooseLlmModelStep: "需要更换模型时，在“模型名称”里选择或填写模型 ID。",
    llmTemplateFreeNote: "以上均有新用户免费额度或免费模型，有效期以官方页面为准。",
    openaiCompatibleFormat: "OpenAI 兼容格式",
    anthropicCompatibleFormat: "Anthropic 兼容格式",
    openaiCompatibleBody: "适用于 OpenAI、DeepSeek、硅基流动、OpenRouter，以及其他兼容 Chat Completions 的平台。",
    anthropicCompatibleBody: "适用于 Anthropic Claude，或提供 Anthropic Messages 兼容接口的平台。",
    llmFieldsTitle: "插件里怎么填",
    customLlmTitle: "自定义档案",
    llmCustomIntro: "自定义档案用于接入其他翻译模型服务。新增档案后，按服务商文档填写接口格式、接口地址、模型名称和 API Key。LM Studio、Ollama 或其他 llama 本地模型工具只要提供兼容接口，也可以用自定义档案接入。",
    llmFormatField: "接口格式",
    llmBaseUrlField: "接口地址",
    llmModelField: "模型名称",
    llmApiKeyField: "API 密钥",
    llmProfileNameValue: "写一个自己能认出来的名称，只影响档案列表显示。",
    llmFormatValue: "接入 Chat Completions 风格接口时选择“OpenAI 兼容格式”；接入 Anthropic Messages 风格接口时选择“Anthropic 兼容格式”。",
    llmBaseUrlValue: "填写服务商提供的 API Base URL。本机模型服务也填写它自己的本机地址，例如 http://127.0.0.1:1234/v1 或 http://127.0.0.1:11434/v1。",
    modelValue: "填写平台控制台、文档或本地模型工具里显示的模型 ID。",
    apiKeyValue: "填写该服务创建的 API Key；本地模型工具如果不校验密钥，可以填写任意占位文本。",
    targetLanguage: "目标语言",
    translationWorkers: "翻译并发",
    llmTargetLanguageValue: "选择字幕要翻译成的语言。保存后，新任务和“重新翻译字幕”都会使用当前目标语言。",
    llmWorkersValue: "控制同时请求翻译模型的字幕分组数量。遇到限流或返回不稳定时调低。",
    llmAfterSaveValue: "新任务会使用当前翻译档案；已有原文字幕可以点击“重新翻译字幕”。",
    llmJsonNote: "翻译模型需要稳定按插件要求返回结构化结果；部分模型的内容审查可能较严格，如果经常失败，可以更换模型或降低翻译并发。",
    llmRetranslateNote: "“重新翻译字幕”只会使用已有原文重新调用翻译模型，不会重新调用 ASR。",
    llmServerNote: "翻译字幕时保持本地模型服务运行。",
    llmTargetLanguageNote: "目标语言在插件“目标语言”里选择，保存后新任务和重翻译会按当前目标语言执行。"
  },
  en: {
    backSettings: "← Back to Settings",
    asrTitle: "Speech Recognition API Guide",
    asrDocumentTitle: "Speech Recognition API Guide - LiuSheng Subtitles",
    asrLead: "Speech recognition turns video audio into source subtitles. After setup, return to Tasks & Subtitles, choose the source language, and start extraction.",
    onlineApi: "Online API",
    asrOnlineIntro: "The extension includes these ASR profiles. Pick a template and fill in the API key to use it. You can also add a Whisper-compatible profile with a base URL, model name, and API key.",
    bailianConsole: "Bailian console",
    groqConsole: "Groq console",
    openaiPlatform: "OpenAI platform",
    xaiConsole: "xAI console",
    createApiKeySuffix: "create an API key.",
    bailianFunAsr: "Alibaba Cloud Bailian Fun-ASR",
    bailianKeyStep: "Create an API key in the Bailian console.",
    chooseFunAsrStep: "Choose Fun-ASR under Speech Recognition.",
    groqKeyStep: "Create an API key in the Groq console.",
    chooseGroqStep: "Choose Groq Whisper under Speech Recognition.",
    openaiKeyStep: "Create an API key in the OpenAI platform.",
    chooseOpenAiStep: "Choose OpenAI Whisper under Speech Recognition.",
    xaiKeyStep: "Create an API key in the xAI console.",
    chooseXaiStep: "Choose xAI Grok under Speech Recognition.",
    fillAsrKeyStep: "Paste the API key into API Key.",
    saveSettingsStep: "Save settings.",
    funAsrPriceValue: "CNY 0.0132/min",
    funAsrPriceNote: "New-user credits and validity follow the official page.",
    groqPriceValue: "USD 0.00067/min",
    groqPriceHourly: "USD 0.04/hour",
    openaiPriceValue: "USD 0.006/min",
    xaiPriceValue: "USD 0.00167/min",
    xaiPriceHourly: "USD 0.10/hour",
    priceNotice: "Prices are converted from public pages in May 2026 and may change. Check each provider console and bill for the final amount.",
    localDeploy: "Local Deployment",
    asrLocalLead: "After local Speaches starts, set the API base URL to http://127.0.0.1:8000/v1.",
    windows: "Windows",
    mac: "Mac",
    installDocker: "Install Docker Desktop.",
    installNvidiaDriver: "Install or update the NVIDIA driver.",
    waitDocker: "Open Docker Desktop and wait for Docker to start.",
    openPowershell: "Open PowerShell.",
    openTerminal: "Open Terminal.",
    runCommand: "Run this command.",
    openSpeachesDocs: "Open http://127.0.0.1:8000/docs in the browser. Continue after the Speaches page appears.",
    keepSpeachesRunning: "Keep Docker Desktop and the speaches container running while generating subtitles.",
    pluginSettings: "Extension Settings",
    editing: "Editing",
    asrEditingValue: "Choose Custom Profile, or click Add Profile.",
    profileName: "Profile Name",
    localSpeachesAsr: "Local Speaches ASR",
    apiType: "API Type",
    whisperCompatible: "Whisper-compatible API",
    apiBaseUrl: "API Base URL",
    modelName: "Model",
    vadFilter: "VAD Filter",
    auto: "Auto",
    apiKey: "API Key",
    afterSave: "After Saving",
    asrAfterSaveValue: "Return to Tasks & Subtitles, choose the source language, then start extraction.",
    notes: "Notes",
    speachesFirstDownload: "Speaches downloads the model on first start, so the first wait can be longer.",
    speachesReuseModel: "Later runs reuse the downloaded model.",
    doNotCloseDocker: "Do not close Docker Desktop while recognizing subtitles.",
    wrongSubtitleLanguage: "If the subtitle language is wrong, choose the correct source language first, then rerun ASR.",
    copyCommand: "Copy command",
    copied: "Copied",

    llmTitle: "Translation Model Setup",
    llmDocumentTitle: "Translation Model Setup - LiuSheng Subtitles",
    llmLead: "The translation model API translates source subtitles into the target language. After setup, return to Tasks & Subtitles to start extraction or retranslate existing source text.",
    llmTemplatesTitle: "Built-in Templates",
    llmTemplateIntro: "The extension includes profiles for SiliconFlow, Alibaba Cloud Bailian, Volcengine, and OpenRouter. Pick a template and fill in the API key to use it. A default model is already filled in, and you can choose or type any supported model ID in Model.",
    siliconflow: "SiliconFlow",
    bailian: "Alibaba Cloud Bailian",
    volcengine: "Volcengine",
    siliconflowKeyStep: "Create an API key in the SiliconFlow console.",
    bailianLlmKeyStep: "Create an API key in the Bailian console.",
    volcengineKeyStep: "Create an API key in the Volcengine Ark console.",
    openrouterKeyStep: "Create an API key in OpenRouter.",
    chooseSiliconflowStep: "Choose SiliconFlow under Translation Model.",
    chooseBailianLlmStep: "Choose Alibaba Cloud Bailian under Translation Model.",
    chooseVolcengineStep: "Choose Volcengine under Translation Model.",
    chooseOpenrouterStep: "Choose OpenRouter under Translation Model.",
    fillLlmKeyStep: "Paste the API key into API Key.",
    chooseLlmModelStep: "To change models, choose or type the model ID in Model.",
    llmTemplateFreeNote: "These platforms provide new-user free credits or free models. Validity and availability follow each official page.",
    openaiCompatibleFormat: "OpenAI-compatible Format",
    anthropicCompatibleFormat: "Anthropic-compatible Format",
    openaiCompatibleBody: "Use this for OpenAI, DeepSeek, SiliconFlow, OpenRouter, and other Chat Completions-compatible providers.",
    anthropicCompatibleBody: "Use this for Anthropic Claude, or providers that expose an Anthropic Messages-compatible API.",
    llmFieldsTitle: "Fields in the Extension",
    customLlmTitle: "Custom Profile",
    llmCustomIntro: "Use a custom profile for other translation model services. Add a profile, then fill in the API format, base URL, model name, and API key from the provider docs. LM Studio, Ollama, or other local llama services can also be used if they expose a compatible API.",
    llmFormatField: "API Format",
    llmBaseUrlField: "API Base URL",
    llmModelField: "Model",
    llmApiKeyField: "API Key",
    llmProfileNameValue: "Use a recognizable name. It only affects the profile list.",
    llmFormatValue: "Choose OpenAI-compatible for Chat Completions-style APIs. Choose Anthropic-compatible for Anthropic Messages-style APIs.",
    llmBaseUrlValue: "Use the provider's API base URL. For a local model service, use its local URL, such as http://127.0.0.1:1234/v1 or http://127.0.0.1:11434/v1.",
    modelValue: "Use the model ID shown in the provider console, documentation, or local service.",
    apiKeyValue: "Use the API key created by that service. If a local service does not check keys, enter any placeholder text.",
    targetLanguage: "Target Language",
    translationWorkers: "Translation Workers",
    llmTargetLanguageValue: "Choose the language subtitles should be translated into. Saved settings apply to new tasks and Retranslate.",
    llmWorkersValue: "Controls how many subtitle groups are sent to the translation model at the same time. Lower it if the provider rate-limits or returns unstable results.",
    llmAfterSaveValue: "New tasks use the current translation profile. Existing source subtitles can be translated again with Retranslate.",
    llmJsonNote: "The translation model must reliably return the structured result expected by the extension. Some models may apply stricter content review; if failures repeat, switch models or lower translation concurrency.",
    llmRetranslateNote: "Retranslate uses existing source subtitles and calls only the translation model. It does not rerun ASR.",
    llmServerNote: "Keep the local model service running while translating subtitles.",
    llmTargetLanguageNote: "Choose the target language in the extension. New tasks and retranslations use the currently saved target language."
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyLocale(resolveLocale());
  setupCopyButtons();
});

window.addEventListener("storage", event => {
  if (event.key === UI_LOCALE_STORAGE_KEY) {
    applyLocale(resolveLocale());
  }
});

function resolveLocale() {
  const queryLocale = resolveQueryLocale();
  if (queryLocale) {
    return queryLocale;
  }
  try {
    const stored = window.localStorage?.getItem(UI_LOCALE_STORAGE_KEY);
    const storedLocale = normalizeLocaleCode(stored);
    if (storedLocale) {
      return storedLocale;
    }
  } catch {
    // Local storage may be unavailable in privacy modes.
  }
  return browserPrefersChinese() ? "zh" : DEFAULT_LOCALE;
}

function resolveQueryLocale() {
  try {
    const params = new URLSearchParams(window.location?.search || "");
    return normalizeLocaleCode(params.get("lang") || params.get("locale"));
  } catch {
    return "";
  }
}

function normalizeLocaleCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (LOCALES.has(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return "";
}

function browserPrefersChinese() {
  const languages = [];
  if (Array.isArray(navigator.languages)) {
    languages.push(...navigator.languages);
  }
  if (navigator.language) {
    languages.push(navigator.language);
  }
  return languages.length
    ? languages.some(language => String(language || "").toLowerCase().startsWith("zh"))
    : DEFAULT_LOCALE === "zh";
}

function applyLocale(locale) {
  const dictionary = I18N[locale] || I18N[DEFAULT_LOCALE];
  const fallback = I18N[DEFAULT_LOCALE];
  const translate = key => dictionary[key] ?? fallback[key] ?? key;

  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(element => {
    element.title = translate(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });

  const titleKey = document.body.dataset.titleKey;
  if (titleKey) {
    document.title = translate(titleKey);
  }
}

function setupCopyButtons() {
  document.querySelectorAll(".copy-button").forEach(button => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target) {
        return;
      }
      await writeClipboardText(target.textContent);
      const locale = resolveLocale();
      const copied = (I18N[locale] || I18N[DEFAULT_LOCALE]).copied;
      const copyCommand = (I18N[locale] || I18N[DEFAULT_LOCALE]).copyCommand;
      button.setAttribute("aria-label", copied);
      button.setAttribute("title", copied);
      window.setTimeout(() => {
        button.setAttribute("aria-label", copyCommand);
        button.setAttribute("title", copyCommand);
      }, 1600);
    });
  });
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection-based path used by older extension pages.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
