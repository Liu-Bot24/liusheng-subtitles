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
      model: "",
      vadFilter: "auto",
      apiKey: ""
    },
    {
      id: "dashscope_funasr",
      name: "Fun-ASR",
      providerType: "dashscope_funasr",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      model: "fun-asr",
      vadFilter: "off",
      apiKey: ""
    },
    {
      id: "custom_asr",
      name: "自定义档案",
      providerType: "openai",
      baseUrl: "",
      model: "",
      vadFilter: "auto",
      apiKey: ""
    }
  ];
  const KNOWN_LLM_PROFILES = [
    {
      id: "siliconflow_llm",
      name: "硅基流动",
      providerType: "openai",
      baseUrl: "https://api.siliconflow.cn/v1",
      model: "deepseek-ai/DeepSeek-V4-Flash",
      apiKey: ""
    },
    {
      id: "bailian_llm",
      name: "阿里云百炼",
      providerType: "openai",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.7-max",
      apiKey: ""
    },
    {
      id: "volcengine_llm",
      name: "火山引擎",
      providerType: "openai",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      model: "doubao-seed-2-0-lite-260428",
      apiKey: ""
    },
    {
      id: "openrouter_llm",
      name: "OpenRouter",
      providerType: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "deepseek/deepseek-v4-flash:free",
      apiKey: ""
    },
    {
      id: "openai_custom",
      name: "自定义档案",
      providerType: "openai",
      baseUrl: "",
      model: "",
      apiKey: ""
    }
  ];
  const BUILT_IN_ASR_PROFILE_IDS = new Set(["openai_whisper", "groq_whisper", "xai_grok", "dashscope_funasr"]);
  const BUILT_IN_LLM_PROFILE_IDS = new Set(["siliconflow_llm", "bailian_llm", "volcengine_llm", "openrouter_llm"]);

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
        profilesById.set(profile.id, normalizeCustomProfile(kind, profile));
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

  function normalizeCustomProfile(kind, profile) {
    const providerType = normalizeCustomProfileProviderType(kind, profile.providerType);
    return {
      ...profile,
      providerType,
      vadFilter: kind === "asr" && profile.providerType === "dashscope_funasr"
        ? "auto"
        : profile.vadFilter
    };
  }

  function mergeProfileDefaults(defaultProfile, storedProfile) {
    if (isBuiltInAsrProfile(defaultProfile)) {
      return {
        ...cloneProfile(defaultProfile),
        apiKey: storedProfile.apiKey || defaultProfile.apiKey || ""
      };
    }
    if (isBuiltInLlmProfile(defaultProfile)) {
      return {
        ...cloneProfile(defaultProfile),
        baseUrl: storedProfile.baseUrl || defaultProfile.baseUrl || "",
        model: storedProfile.model || defaultProfile.model || "",
        apiKey: storedProfile.apiKey || defaultProfile.apiKey || ""
      };
    }
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

  function isBuiltInAsrProfile(profile) {
    return BUILT_IN_ASR_PROFILE_IDS.has(profile?.id);
  }

  function isBuiltInLlmProfile(profile) {
    return BUILT_IN_LLM_PROFILE_IDS.has(profile?.id);
  }

  function profilesForStorage(kind, profiles) {
    return uniqueProfiles(profiles).map(profile => profileForStorage(kind, profile));
  }

  function profileForStorage(kind, rawProfile) {
    const profile = normalizeProfile(rawProfile);
    if (kind === "asr" && isBuiltInAsrProfile(profile)) {
      const storedProfile = { id: profile.id };
      if (profile.apiKey) {
        storedProfile.apiKey = profile.apiKey;
      }
      return storedProfile;
    }
    if (kind === "llm" && isBuiltInLlmProfile(profile)) {
      const defaultProfile = KNOWN_LLM_PROFILES.find(item => item.id === profile.id) || {};
      const storedProfile = { id: profile.id };
      if (profile.baseUrl && profile.baseUrl !== defaultProfile.baseUrl) {
        storedProfile.baseUrl = profile.baseUrl;
      }
      if (profile.model && profile.model !== defaultProfile.model) {
        storedProfile.model = profile.model;
      }
      if (profile.apiKey) {
        storedProfile.apiKey = profile.apiKey;
      }
      return storedProfile;
    }
    const providerType = normalizeCustomProfileProviderType(kind, profile.providerType);
    const storedProfile = {
      id: profile.id,
      name: profile.name || "",
      providerType,
      baseUrl: profile.baseUrl || "",
      model: profile.model || "",
      apiKey: profile.apiKey || ""
    };
    if (kind === "asr") {
      storedProfile.vadFilter = providerType === "dashscope_funasr"
        ? "off"
        : FuguangBrowserAsrProvider.normalizeAsrVadFilterMode(profile.vadFilter);
    }
    return storedProfile;
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

  function normalizeCustomProfileProviderType(kind, providerType) {
    const normalized = normalizeProviderType(providerType);
    if (kind === "llm") {
      return normalized === "anthropic" ? "anthropic" : "openai";
    }
    return "openai";
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
    normalizeStoredProfiles,
    profilesForStorage
  };
})();
