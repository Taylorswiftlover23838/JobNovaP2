import { LINKEDIN_JOB_LISTINGS } from "./linkedinData";
import { runJobSourceAgent, AgentResult } from "./webAgent";
import fs from "fs";

async function main() {
  console.log("\n======================================");
  console.log("🚀 Jobnova AI Job Source Agent (Demo)");
  console.log("======================================\n");

  const results: AgentResult[] = [];

  for (const listing of LINKEDIN_JOB_LISTINGS) {
    console.log("\n--------------------------------------");
    console.log(`🏢 Processing: ${listing.companyName}`);
    console.log("--------------------------------------");

    const result = await runJobSourceAgent(
      listing.companyName,
      listing.linkedinUrl,
      listing.companyWebsite
    );

    results.push(result);

    console.log("\n✅ Result:");
    console.log(JSON.stringify(result, null, 2));
  }

  /**
   * =========================
   * SUMMARY STATS
   * =========================
   */
  const success = results.filter(
    (r) => r.careerPageUrl && r.openPositionUrl
  );

  const partial = results.filter(
    (r) => r.careerPageUrl && !r.openPositionUrl
  );

  const failed = results.filter((r) => !r.careerPageUrl);

  console.log("\n======================================");
  console.log("📊 FINAL SUMMARY");
  console.log("======================================");
  console.log(`Total: ${results.length}`);
  console.log(`✅ Fully successful: ${success.length}`);
  console.log(`⚠️ Partial: ${partial.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  /**
   * =========================
   * JSON OUTPUT
   * =========================
   */
  const jsonPath = "results.json";
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  console.log(`\n📁 Saved JSON → ${jsonPath}`);

  /**
   * =========================
   * CSV OUTPUT (for submission)
   * =========================
   */
  const csvLines = [
    "companyName,careerPageUrl,openPositionUrl",
    ...results.map((r) => {
      return `"${r.companyName}","${r.careerPageUrl ?? ""}","${
        r.openPositionUrl ?? ""
      }"`;
    }),
  ];

  const csvPath = "results.csv";
  fs.writeFileSync(csvPath, csvLines.join("\n"));

  console.log(`📁 Saved CSV → ${csvPath}`);

  /**
   * =========================
   * CLEAN CONSOLE OUTPUT
   * =========================
   */
  console.log("\n======================================");
  console.log("📦 FINAL OUTPUT (JSON)");
  console.log("======================================\n");

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
