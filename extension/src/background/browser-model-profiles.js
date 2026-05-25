import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";

export const FuguangBrowserModelProfiles = (() => {
  const DEFAULT_ASR_PROFILE_ID = "openai_whisper";
  const DEFAULT_LLM_PROFILE_ID = "openai_custom";
  const KNOWN_ASR_PROFILES = [
    {
      id: "openai_whisper",
      name: "OpenAI Whisper",
      providerType: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "whisper-1",
      vadFilter: "auto",
      apiKey: ""
    },
    {
      id: "groq_whisper",
      name: "Groq Whisper",
      providerType: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "whisper-large-v3-turbo",
      vadFilter: "auto",
      apiKey: ""
    },
    {
      id: "xai_grok",
      name: "xAI Grok",
      providerType: "xai",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-2-voice-1212",
      vadFilter: "auto",
      apiKey: ""
    },
    {
      id: "dashscope_funasr",
      name: "阿里云 Fun-ASR",
      providerType: "dashscope_funasr",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      model: "fun-asr",
      vadFilter: "off",
      apiKey: ""
    },
    {
      id: "custom_asr",
      name: "自定义 ASR",
      providerType: "openai",
      baseUrl: "",
      model: "",
      vadFilter: "auto",
      apiKey: ""
    }
  ];
  const KNOWN_LLM_PROFILES = [
    {
      id: "openai_custom",
      name: "自定义档案",
      providerType: "openai",
      baseUrl: "",
      model: "",
      apiKey: ""
    }
  ];

  function findProfile(profiles, selectedId, fallbackId) {
    return profiles.find(profile => profile.id === selectedId) ||
      profiles.find(profile => profile.id === fallbackId) ||
      profiles[0] ||
      {};
  }

  function normalizeSelectedProfileId(profiles, selectedId, fallbackId) {
    if (profiles.some(profile => profile.id === selectedId)) {
      return selectedId;
    }
    if (profiles.some(profile => profile.id === fallbackId)) {
      return fallbackId;
    }
    return profiles[0]?.id || "";
  }

  function normalizeStoredProfiles(kind, storedProfiles) {
    const profilesById = new Map(defaultProfiles(kind).map(profile => [profile.id, profile]));
    for (const rawProfile of Array.isArray(storedProfiles) ? storedProfiles : []) {
      const profile = normalizeProfile(rawProfile);
      if (!profile.id) {
        continue;
      }
      const knownProfile = profilesById.get(profile.id);
      if (knownProfile) {
        profilesById.set(profile.id, mergeProfileDefaults(knownProfile, profile));
      } else if (hasProfileContent(profile)) {
        profilesById.set(profile.id, profile);
      }
    }
    return uniqueProfiles([...profilesById.values()]);
  }

  function normalizeProfile(rawProfile = {}) {
    return {
      id: String(rawProfile.id || "").trim(),
      name: String(rawProfile.name || "").trim(),
      providerType: normalizeProviderType(rawProfile.providerType || rawProfile.provider_type),
      baseUrl: String(rawProfile.baseUrl || rawProfile.base_url || "").trim(),
      model: String(rawProfile.model || "").trim(),
      vadFilter: FuguangBrowserAsrProvider.normalizeAsrVadFilterMode(rawProfile.vadFilter || rawProfile.vad_filter || rawProfile.vadFilterMode),
      apiKey: String(rawProfile.apiKey || rawProfile.api_key || "").trim()
    };
  }

  function normalizeProviderType(providerType) {
    const value = String(providerType || "").trim();
    return ["openai", "groq", "xai", "anthropic", "dashscope_funasr"].includes(value) ? value : "openai";
  }

  function mergeProfileDefaults(defaultProfile, storedProfile) {
    return {
      id: storedProfile.id || defaultProfile.id,
      name: storedProfile.name || defaultProfile.name || "",
      providerType: storedProfile.providerType || defaultProfile.providerType || "openai",
      baseUrl: storedProfile.baseUrl || defaultProfile.baseUrl || "",
      model: storedProfile.model || defaultProfile.model || "",
      vadFilter: storedProfile.vadFilter || defaultProfile.vadFilter || "auto",
      apiKey: storedProfile.apiKey || defaultProfile.apiKey || ""
    };
  }

  function hasProfileContent(profile) {
    if (profile.id === DEFAULT_LLM_PROFILE_ID && !profile.apiKey && !profile.baseUrl && !profile.model) {
      return false;
    }
    return Boolean(profile.apiKey || profile.baseUrl || profile.model || profile.name);
  }

  function uniqueProfiles(profiles) {
    const seen = new Set();
    const output = [];
    for (const profile of profiles) {
      if (seen.has(profile.id)) {
        continue;
      }
      seen.add(profile.id);
      output.push({
        ...profile,
        name: profile.name || profile.model || "未命名档案"
      });
    }
    return output;
  }

  function defaultProfiles(kind) {
    return knownProfileDefaults(kind).map(cloneProfile);
  }

  function knownProfileDefaults(kind) {
    return kind === "asr" ? KNOWN_ASR_PROFILES : KNOWN_LLM_PROFILES;
  }

  function cloneProfile(profile) {
    return {
      id: profile.id,
      name: profile.name || "",
      providerType: profile.providerType || "openai",
      baseUrl: profile.baseUrl || "",
      model: profile.model || "",
      vadFilter: profile.vadFilter || "auto",
      apiKey: profile.apiKey || ""
    };
  }

  function compactProviderConfig(config) {
    const output = {};
    for (const [key, value] of Object.entries(config || {})) {
      if (key === "id" || key === "name") {
        continue;
      }
      if (value !== undefined && value !== null && String(value).trim()) {
        output[key] = String(value).trim();
      }
    }
    return output;
  }

  return {
    DEFAULT_ASR_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID,
    KNOWN_ASR_PROFILES,
    KNOWN_LLM_PROFILES,
    compactProviderConfig,
    findProfile,
    normalizeProviderType,
    normalizeSelectedProfileId,
    normalizeStoredProfiles
  };
})();
