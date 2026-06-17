export interface LinkedInJobListing {
  linkedinUrl: string;
  companyName: string;
  companyWebsite: string;
}

/**
 * Demo dataset
 * These companies all have real career pages and ATS systems,
 * which makes your agent reliably work during the demo.
 */
export const LINKEDIN_JOB_LISTINGS: LinkedInJobListing[] = [
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/software-engineer-at-github",
    companyName: "GitHub",
    companyWebsite: "https://github.com",
  },
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/software-engineer-at-stripe",
    companyName: "Stripe",
    companyWebsite: "https://stripe.com",
  },
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/product-designer-at-notion",
    companyName: "Notion",
    companyWebsite: "https://www.notion.so",
  },
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/software-engineer-at-linear",
    companyName: "Linear",
    companyWebsite: "https://linear.app",
  },
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/software-engineer-at-vercel",
    companyName: "Vercel",
    companyWebsite: "https://vercel.com",
  },
  {
    linkedinUrl:
      "https://www.linkedin.com/jobs/view/data-scientist-at-airbnb",
    companyName: "Airbnb",
    companyWebsite: "https://airbnb.com",
  },
];
