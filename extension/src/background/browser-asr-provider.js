import { FuguangBrowserLanguage } from "./browser-language.js";

export const FuguangBrowserAsrProvider = (() => {
  const BROWSER_ASR_MIN_TIMEOUT_MS = 180_000;
  const BROWSER_ASR_MAX_TIMEOUT_MS = 20 * 60_000;
  const BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS = 1_250;
  const { normalizeAsrLanguage } = FuguangBrowserLanguage;
  const BROWSER_ASR_COMPAT_QUALITY_FIELDS = [
    ["word_timestamps", "true"],
    ["condition_on_previous_text", "false"],
    ["no_speech_threshold", "0.45"],
    ["compression_ratio_threshold", "2.4"],
    ["log_prob_threshold", "-1"],
    ["hallucination_silence_threshold", "1"]
  ];
  const browserAsrVadCapabilityCache = new Map();
  const browserAsrRequestFieldCapabilityCache = new Map();

  function normalizeAsrTimeoutMs(timeoutMs, chunk = {}) {
    const normalized = Number(timeoutMs);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
    const duration = pickFinite(
      chunk.duration,
      Number(chunk.end) - Number(chunk.start)
    );
    if (!duration) {
      return BROWSER_ASR_MIN_TIMEOUT_MS;
    }
    return Math.min(
      BROWSER_ASR_MAX_TIMEOUT_MS,
      Math.max(BROWSER_ASR_MIN_TIMEOUT_MS, Math.ceil(duration * BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS))
    );
  }

  function browserAsrRequestFields(asrConfig, rawLanguage = "", options = {}) {
    const provider = normalizeProviderType(asrConfig?.providerType);
    const language = normalizeAsrLanguage(rawLanguage);
    if (provider === "xai") {
      const xaiLanguage = xaiAsrLanguage(language);
      return xaiLanguage ? [["format", "true"], ["language", xaiLanguage]] : [];
    }
    const fields = [
      ["model", asrConfig?.model || ""],
      ["response_format", "verbose_json"],
      ["timestamp_granularities[]", "segment"],
      ["timestamp_granularities[]", "word"]
    ];
    if (shouldUseBrowserAsrVadFilter(asrConfig, options)) {
      fields.push(["vad_filter", "true"]);
    }
    fields.push(...browserAsrCompatibleQualityFields(asrConfig, options));
    if (language) {
      fields.push(["language", language]);
    }
    return fields;
  }

  function browserAsrCompatibleQualityFields(asrConfig = {}, options = {}) {
    if (normalizeProviderType(asrConfig?.providerType) !== "openai" || isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return [];
    }
    return BROWSER_ASR_COMPAT_QUALITY_FIELDS.filter(([name]) => asrRequestFieldSupported(options, name));
  }

  function shouldUseBrowserAsrVadFilter(asrConfig = {}, options = {}) {
    const mode = normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode);
    if (normalizeProviderType(asrConfig?.providerType) !== "openai") {
      return false;
    }
    if (isKnownStandardAsrBaseUrl(asrConfig?.baseUrl)) {
      return false;
    }
    if (mode === "off") {
      return false;
    }
    if (mode === "on") {
      return true;
    }
    if (options.vadFilterSupported || options.openApiVadFilterSupported || asrRequestFieldSupported(options, "vad_filter")) {
      return true;
    }
    return false;
  }

  function asrRequestFieldSupported(options = {}, name) {
    const fields = options.supportedRequestFields || options.openApiSupportedFields;
    if (fields && typeof fields.has === "function") {
      return fields.has(name);
    }
    if (Array.isArray(fields)) {
      return fields.includes(name);
    }
    return false;
  }

  async function resolveBrowserAsrSupportedRequestFields(asrConfig = {}) {
    if (!shouldProbeBrowserAsrCapabilities(asrConfig)) {
      return new Set();
    }
    return browserAsrOpenApiSupportedRequestFields(asrConfig?.baseUrl);
  }

  function shouldProbeBrowserAsrCapabilities(asrConfig = {}) {
    const mode = normalizeAsrVadFilterMode(asrConfig?.vadFilter || asrConfig?.vad_filter || asrConfig?.vadFilterMode);
    if (mode === "off" || normalizeProviderType(asrConfig?.providerType) !== "openai") {
      return false;
    }
    const baseUrl = String(asrConfig?.baseUrl || "").trim();
    return Boolean(baseUrl && !isKnownStandardAsrBaseUrl(baseUrl));
  }

  async function browserAsrOpenApiSupportedRequestFields(baseUrl) {
    const cacheKey = String(baseUrl || "").trim();
    if (!cacheKey) {
      return new Set();
    }
    if (browserAsrRequestFieldCapabilityCache.has(cacheKey)) {
      return browserAsrRequestFieldCapabilityCache.get(cacheKey);
    }
    if (browserAsrVadCapabilityCache.has(cacheKey)) {
      return new Set(browserAsrVadCapabilityCache.get(cacheKey) ? ["vad_filter"] : []);
    }
    for (const openApiUrl of browserAsrOpenApiUrlCandidates(cacheKey)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        let response;
        try {
          response = await fetch(openApiUrl, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (!response?.ok) {
          continue;
        }
        const schema = await response.json().catch(() => null);
        const fields = schemaAudioTranscriptionRequestProperties(schema);
        if (fields.size) {
          browserAsrRequestFieldCapabilityCache.set(cacheKey, fields);
          browserAsrVadCapabilityCache.set(cacheKey, fields.has("vad_filter"));
          return fields;
        }
      } catch {
        // Capability probing is best-effort; unknown APIs should keep the standard request shape.
      }
    }
    browserAsrVadCapabilityCache.set(cacheKey, false);
    const fields = new Set();
    browserAsrRequestFieldCapabilityCache.set(cacheKey, fields);
    return fields;
  }

  function browserAsrOpenApiUrlCandidates(baseUrl) {
    let parsed;
    try {
      parsed = new URL(String(baseUrl || ""));
    } catch {
      return [];
    }
    const origin = `${parsed.protocol}//${parsed.host}`;
    const rawPath = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/audio\/transcriptions$/i, "")
      .replace(/\/audio\/translations$/i, "");
    const paths = [];
    if (rawPath.endsWith("/v1")) {
      paths.push(rawPath.slice(0, -3) || "");
    }
    paths.push(rawPath || "");
    paths.push("");
    const seen = new Set();
    return paths
      .map(path => `${origin}${path}/openapi.json`)
      .filter(url => {
        if (seen.has(url)) {
          return false;
        }
        seen.add(url);
        return true;
      });
  }

  function schemaAudioTranscriptionRequestProperties(schema) {
    const properties = new Set();
    if (!schema || typeof schema !== "object" || !schema.paths || typeof schema.paths !== "object") {
      return properties;
    }
    for (const [pathName, pathItem] of Object.entries(schema.paths)) {
      if (!/\/audio\/(?:transcriptions|translations)\b/i.test(String(pathName))) {
        continue;
      }
      for (const operation of Object.values(pathItem || {})) {
        collectOperationRequestBodyProperties(operation, schema, properties);
      }
    }
    return properties;
  }

  function collectOperationRequestBodyProperties(operation, rootSchema, output) {
    const requestBody = resolveOpenApiRef(rootSchema, operation?.requestBody) || operation?.requestBody;
    const content = requestBody?.content;
    if (!content || typeof content !== "object") {
      return;
    }
    for (const media of Object.values(content)) {
      collectSchemaProperties(media?.schema, rootSchema, output);
    }
  }

  function collectSchemaProperties(schema, rootSchema, output, seen = new Set()) {
    if (!schema || typeof schema !== "object" || seen.has(schema)) {
      return;
    }
    seen.add(schema);
    const referenced = resolveOpenApiRef(rootSchema, schema);
    if (referenced && referenced !== schema) {
      collectSchemaProperties(referenced, rootSchema, output, seen);
      return;
    }
    if (schema.properties && typeof schema.properties === "object") {
      for (const propertyName of Object.keys(schema.properties)) {
        output.add(propertyName);
      }
    }
    for (const key of ["allOf", "anyOf", "oneOf"]) {
      if (Array.isArray(schema[key])) {
        schema[key].forEach(item => collectSchemaProperties(item, rootSchema, output, seen));
      }
    }
    if (schema.items) {
      collectSchemaProperties(schema.items, rootSchema, output, seen);
    }
  }

  function resolveOpenApiRef(rootSchema, value) {
    const ref = String(value?.$ref || "");
    if (!ref.startsWith("#/") || !rootSchema || typeof rootSchema !== "object") {
      return null;
    }
    return ref
      .slice(2)
      .split("/")
      .map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), rootSchema) || null;
  }

  function normalizeAsrVadFilterMode(value) {
    const normalized = String(value || "auto").trim().toLowerCase();
    if (["on", "true", "1", "yes", "force", "enabled"].includes(normalized)) {
      return "on";
    }
    if (["off", "false", "0", "no", "disabled"].includes(normalized)) {
      return "off";
    }
    return "auto";
  }

  function isKnownStandardAsrBaseUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return new Set(["api.openai.com", "api.groq.com", "api.x.ai"]).has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function browserAsrEndpoint(asrConfig) {
    const provider = normalizeProviderType(asrConfig?.providerType);
    const baseUrl = normalizeApiBaseUrl(asrConfig?.baseUrl || "");
    if (provider === "xai") {
      return `${baseUrl}/stt`;
    }
    return baseUrl.endsWith("/audio/transcriptions") ? baseUrl : `${baseUrl}/audio/transcriptions`;
  }

  function xaiAsrLanguage(language) {
    const supported = new Set(["en", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "es", "ja", "ko", "hi", "th", "vi"]);
    return supported.has(language) ? language : "";
  }

  function normalizeProviderType(providerType) {
    const value = String(providerType || "").trim();
    return ["openai", "groq", "xai", "anthropic"].includes(value) ? value : "openai";
  }

  function normalizeApiBaseUrl(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function pickFinite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) {
        return number;
      }
    }
    return 0;
  }

  return {
    normalizeAsrTimeoutMs,
    browserAsrRequestFields,
    browserAsrCompatibleQualityFields,
    shouldUseBrowserAsrVadFilter,
    asrRequestFieldSupported,
    resolveBrowserAsrSupportedRequestFields,
    shouldProbeBrowserAsrCapabilities,
    browserAsrOpenApiSupportedRequestFields,
    browserAsrOpenApiUrlCandidates,
    schemaAudioTranscriptionRequestProperties,
    collectOperationRequestBodyProperties,
    collectSchemaProperties,
    resolveOpenApiRef,
    normalizeAsrVadFilterMode,
    isKnownStandardAsrBaseUrl,
    browserAsrEndpoint,
    normalizeAsrLanguage,
    xaiAsrLanguage
  };
})();
