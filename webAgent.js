import { Page, chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

/**
 * =========================
 * CONFIG
 * =========================
 */

const CHROME_PATH =
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * =========================
 * TYPES
 * =========================
 */

export interface AgentResult {
  companyName: string;
  linkedinUrl: string;
  companyWebsite: string;
  careerPageUrl: string | null;
  openPositionUrl: string | null;
  error?: string;
}

type Link = { text: string; href: string };

/**
 * =========================
 * UTIL: Extract links
 * =========================
 */

async function extractLinks(page: Page): Promise<Link[]> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => {
        const el = a as HTMLAnchorElement;
        return {
          text: (el.innerText || "").trim().slice(0, 100),
          href: el.href,
        };
      })
      .filter((l) => l.href?.startsWith("http"));
  });
}

/**
 * =========================
 * ATS DETECTION (VERY IMPORTANT)
 * =========================
 */

const ATS_PATTERNS = [
  "greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "ashbyhq.com",
  "jobs.ashbyhq.com",
  "workdayjobs.com",
  "smartrecruiters.com",
  "bamboohr.com",
];

function detectATS(url: string): boolean {
  return ATS_PATTERNS.some((p) => url.includes(p));
}

/**
 * =========================
 * CAREER PAGE SCORING (NO LLM)
 * =========================
 */

const CAREER_KEYWORDS = [
  "career",
  "careers",
  "jobs",
  "join",
  "join us",
  "work with us",
  "open roles",
  "hiring",
];

function scoreCareerLink(link: Link, companyDomain: string): number {
  const text = `${link.text} ${link.href}`.toLowerCase();

  let score = 0;

  for (const k of CAREER_KEYWORDS) {
    if (text.includes(k)) score += 10;
  }

  if (link.href.includes(companyDomain)) score += 5;

  if (
    link.href.includes("linkedin") ||
    link.href.includes("indeed") ||
    link.href.includes("glassdoor")
  ) {
    score -= 100;
  }

  return score;
}

function findBestCareerLink(links: Link[], companyWebsite: string) {
  const domain = new URL(companyWebsite).hostname;

  const scored = links
    .map((l) => ({
      ...l,
      score: scoreCareerLink(l, domain),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].href : null;
}

/**
 * =========================
 * JOB LINK SCORING
 * =========================
 */

const JOB_KEYWORDS =
  /(engineer|developer|designer|scientist|manager|analyst|product|marketing|sales|devops|security)/i;

function scoreJobLink(link: Link): number {
  let score = 0;

  if (JOB_KEYWORDS.test(link.text)) score += 20;

  if (
    link.href.includes("/job") ||
    link.href.includes("/jobs") ||
    link.href.includes("/position")
  ) {
    score += 10;
  }

  if (/all jobs|all roles|teams|departments/i.test(link.text)) {
    score -= 10;
  }

  return score;
}

function findBestJobLink(links: Link[]) {
  const scored = links
    .map((l) => ({
      ...l,
      score: scoreJobLink(l),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].href : null;
}

/**
 * =========================
 * CLAUDE FALLBACK (ONLY WHEN NEEDED)
 * =========================
 */

async function askClaude(prompt: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
}

async function fallbackCareerLink(
  companyName: string,
  links: Link[],
  url: string
): Promise<string | null> {
  const prompt = `
You are finding a careers page for ${companyName}.

Current URL: ${url}

Links:
${links.map((l) => `- ${l.text} -> ${l.href}`).join("\n")}

Return ONLY the best careers page URL or "NONE".
`;

  const out = await askClaude(prompt);
  if (out === "NONE" || !out.startsWith("http")) return null;
  return out;
}

async function fallbackJobLink(
  companyName: string,
  links: Link[],
  url: string
): Promise<string | null> {
  const prompt = `
You are finding ONE job posting for ${companyName}.

Current URL: ${url}

Links:
${links.map((l) => `- ${l.text} -> ${l.href}`).join("\n")}

Return ONLY ONE job posting URL or "NONE".
`;

  const out = await askClaude(prompt);
  if (out === "NONE" || !out.startsWith("http")) return null;
  return out;
}

/**
 * =========================
 * MAIN AGENT
 * =========================
 */

export async function runJobSourceAgent(
  companyName: string,
  linkedinUrl: string,
  companyWebsite: string
): Promise<AgentResult> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  let careerPageUrl: string | null = null;
  let openPositionUrl: string | null = null;

  try {
    console.log(`\n🔍 ${companyName}`);
    console.log(`→ Visiting ${companyWebsite}`);

    await page.goto(companyWebsite, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await page.waitForTimeout(1500);

    let links = await extractLinks(page);

    /**
     * STEP 1: CAREER PAGE DETECTION
     */
    careerPageUrl = findBestCareerLink(links, companyWebsite);

    if (!careerPageUrl) {
      careerPageUrl = await fallbackCareerLink(
        companyName,
        links,
        page.url()
      );
    }

    if (!careerPageUrl) {
      return {
        companyName,
        linkedinUrl,
        companyWebsite,
        careerPageUrl: null,
        openPositionUrl: null,
        error: "No career page found",
      };
    }

    /**
     * STEP 2: NAVIGATE CAREERS PAGE
     */
    console.log(`→ Career page: ${careerPageUrl}`);

    await page.goto(careerPageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await page.waitForTimeout(2000);

    links = await extractLinks(page);

    /**
     * STEP 3: ATS FAST PATH
     */
    if (detectATS(page.url())) {
      openPositionUrl =
        links.find((l) => JOB_KEYWORDS.test(l.text))?.href || null;
    }

    /**
     * STEP 4: NORMAL JOB DETECTION
     */
    if (!openPositionUrl) {
      openPositionUrl = findBestJobLink(links);
    }

    /**
     * STEP 5: LLM FALLBACK
     */
    if (!openPositionUrl) {
      openPositionUrl = await fallbackJobLink(
        companyName,
        links,
        page.url()
      );
    }

    return {
      companyName,
      linkedinUrl,
      companyWebsite,
      careerPageUrl,
      openPositionUrl,
    };
  } catch (err: any) {
    return {
      companyName,
      linkedinUrl,
      companyWebsite,
      careerPageUrl,
      openPositionUrl,
      error: err?.message || String(err),
    };
  } finally {
    await browser.close();
  }
}
