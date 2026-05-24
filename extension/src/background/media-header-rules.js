export const FuguangMediaHeaderRules = (() => {
  const MEDIA_HEADER_RULE_ID_BASE = 250000;
  let nextMediaHeaderRuleId = 0;
  const mediaHeaderRuleSessions = new Map();

  async function withMediaRequestHeaderRules(sourceUrl, pageUrl, task, sessionKey = "") {
    const rules = buildMediaHeaderRules(sourceUrl, pageUrl);
    if (!rules.length || !chrome.declarativeNetRequest?.updateSessionRules) {
      return task();
    }
    const ruleIds = rules.map(rule => rule.id);
    const sessionId = String(sessionKey || "");
    const firstRule = rules[0];
    if (sessionId) {
      mediaHeaderRuleSessions.set(sessionId, {
        id: firstRule.id,
        pageHref: firstRule.action.requestHeaders.find(header => header.header === "referer")?.value || "",
        pageOrigin: firstRule.action.requestHeaders.find(header => header.header === "origin")?.value || "",
        domains: new Set(firstRule.condition.requestDomains || [])
      });
    }
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: ruleIds,
      addRules: rules
    });
    try {
      return await task();
    } finally {
      if (sessionId) {
        mediaHeaderRuleSessions.delete(sessionId);
      }
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds }).catch(() => {});
    }
  }

  function buildMediaHeaderRules(sourceUrl, pageUrl) {
    let page;
    try {
      page = new URL(String(pageUrl || ""));
    } catch {
      return [];
    }
    if (!["http:", "https:"].includes(page.protocol)) {
      return [];
    }
    const domains = mediaHeaderRuleDomainsFromUrls(sourceUrl);
    if (!domains.length) {
      return [];
    }
    const id = MEDIA_HEADER_RULE_ID_BASE + (nextMediaHeaderRuleId = (nextMediaHeaderRuleId + 1) % 10000);
    return [buildMediaHeaderRule(id, page.href, page.origin, domains)];
  }

  function buildMediaHeaderRule(id, pageHref, pageOrigin, domains) {
    return {
      id,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "referer", operation: "set", value: pageHref },
          { header: "origin", operation: "set", value: pageOrigin }
        ]
      },
      condition: {
        requestDomains: [...domains].sort(),
        resourceTypes: ["xmlhttprequest", "media", "other"]
      }
    };
  }

  function mediaHeaderRuleDomainsFromUrls(sourceUrls) {
    const urls = Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls];
    const domains = new Set();
    for (const sourceUrl of urls) {
      try {
        const source = new URL(String(sourceUrl || ""));
        if (["http:", "https:"].includes(source.protocol) && source.hostname) {
          domains.add(source.hostname.toLowerCase());
        }
      } catch {
        // Malformed child playlist or segment URLs will surface through the fetch path.
      }
    }
    return [...domains].sort();
  }

  async function updateMediaRequestHeaderRuleDomains(sessionKey, sourceUrls) {
    const session = mediaHeaderRuleSessions.get(String(sessionKey || ""));
    if (!session || !chrome.declarativeNetRequest?.updateSessionRules) {
      return { updated: false, domains: [] };
    }
    let changed = false;
    for (const domain of mediaHeaderRuleDomainsFromUrls(sourceUrls)) {
      if (!session.domains.has(domain)) {
        session.domains.add(domain);
        changed = true;
      }
    }
    const domains = [...session.domains].sort();
    if (!changed) {
      return { updated: false, domains };
    }
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [session.id],
      addRules: [buildMediaHeaderRule(session.id, session.pageHref, session.pageOrigin, domains)]
    });
    return { updated: true, domains };
  }

  const api = {
    withMediaRequestHeaderRules,
    buildMediaHeaderRules,
    buildMediaHeaderRule,
    mediaHeaderRuleDomainsFromUrls,
    updateMediaRequestHeaderRuleDomains
  };
  return api;
})();
