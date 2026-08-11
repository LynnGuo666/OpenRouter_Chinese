  const PROTECTED_TRANSLATION_PATTERN = new RegExp(
    [
      "`[^`\\n]+`",
      "(?:https?:\\/\\/|mailto:)[^\\s]+",
      "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
      "\\b[A-Za-z0-9_.~-]+\\/[A-Za-z0-9_.:~/-]+\\b",
      "[$¥]\\s*[\\d,.]+(?:\\s*[KMBT])?",
      "\\b\\d+(?:\\.\\d+)?(?:K|M|B|T|ms|tps|tok\\/s|%)\\b",
      "\\b(?:USD|CNY|USDC|API|SDK|HTTP|HTTPS|JSON|HTML|CSS|URL|URI|TTFT|TPS|E2E|P50|P90|P95|P99|ELO|MMLU(?:-Pro)?|GPQA|AIME|BFCL|SWE-bench|HLE|AA-LCR|GDPval-AA|CritPt|SciCode|IFBench|LiveCodeBench|Terminal-Bench Hard|AA-Omniscience|AI|LLM|RAG|CLI|IDE|MCP|PDF|PR|BYOK|CDP|SDLC|AST|SSO|SAML|SLA|ZDR|GDPR|SOC-2|VAT|S3)\\b",
      "(?:τ²|TAU)-Bench(?:\\s+(?:Airline|Retail|Telecom))?",
      `\\b(?:NYU & Collaborators|Centre for AI Safety|Google Research|CMU & MBZUAI|Stanford & Collaborators|Artificial Analysis|Design Arena|Hermes Agent|Kilo Code|Cloudflare|TIGER Lab|Replit|Ori|MAA|${PROTECTED_ENTITY_PATTERN_SOURCE})\\b`,
      "(?:\\b(?:npm|pnpm|Yarn|Bun|Deno|pip|Python|TypeScript|JavaScript|Shell|cURL|Ruby|PHP|Java|Rust|Kotlin|Swift|callModel)\\b|C#|Node\\.js)",
      "[\\u3400-\\u9fff]+",
    ].join("|"),
    "gi",
  );
  const PROTECTED_HTTP_METHOD_PATTERN = /\b(?:GET|POST|PUT|PATCH|DELETE)\b/g;
