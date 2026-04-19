import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SpellingApp } from "@/components/spelling/spelling-app";

async function getGeminiAvailability() {
  const processEnvKey = typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined;
  if (processEnvKey) {
    return true;
  }

  try {
    const context = await getCloudflareContext({ async: true });
    return Boolean((context.env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY);
  } catch {
    return false;
  }
}

export default async function Home() {
  const hasGeminiKey = await getGeminiAvailability();

  return (
    <SpellingApp hasGeminiKey={hasGeminiKey} />
  );
}
