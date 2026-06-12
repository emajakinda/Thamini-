/*
 * Anthropic API layer. Every call includes the web search tool so output is
 * grounded in current data, never training data. Calls work in two modes:
 *  - Inside the Claude artifact environment: no API key required.
 *  - Standalone: the analyst provides an API key (settings gear) and the
 *    request carries the direct-browser-access header.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

async function postMessage({ system, messages, maxTokens, apiKey, maxWebSearches }) {
  const headers = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxWebSearches,
      },
    ],
  };

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the Anthropic API. Check your internet connection and that your API key in Settings is correct (no extra spaces)."
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* fall through to status-based error below */
  }

  if (!res.ok) {
    const message = data?.error?.message || `API request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function textOf(content) {
  return (content || [])
    .filter((block) => block && block.type === "text")
    .map((block) => block.text)
    .join("");
}

/*
 * Run a single research query. Handles pause_turn continuations from the
 * server-side web search loop and accumulates text across continuations.
 */
export async function runResearchQuery({ system, userMessage, maxTokens = 6000, apiKey, maxWebSearches = 8 }) {
  const key = (apiKey || "").trim();
  const inArtifactEnvironment = typeof window !== "undefined" && Boolean(window.claude);
  if (!key && !inArtifactEnvironment) {
    throw new Error(
      "No API key set. Click Settings in the top-right corner and paste your Anthropic API key (create one at console.anthropic.com)."
    );
  }
  const messages = [{ role: "user", content: userMessage }];
  let accumulated = "";

  for (let attempt = 0; attempt < 4; attempt++) {
    const data = await postMessage({ system, messages, maxTokens, apiKey: key, maxWebSearches });

    if (data.stop_reason === "refusal") {
      throw new Error("The model declined this request.");
    }

    accumulated += textOf(data.content);

    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    break;
  }

  const text = accumulated.trim();
  if (!text) {
    throw new Error("The model returned an empty response. Try the query again.");
  }
  return text;
}

/* Extract the first complete JSON object from a model response. */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("No JSON object found in the model response.");
  }
  return JSON.parse(text.slice(start, end + 1));
}
