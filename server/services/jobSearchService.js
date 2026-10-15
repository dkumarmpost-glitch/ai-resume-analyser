/**
 * jobSearchService.js
 *
 * Job search using Jooble REST API.
 * India-focused.
 */

const https = require("https");

// ── Jooble Configuration ────────────────────────────────────────────────────

const JOOBLE_API_KEY = process.env.JOOBLE_API_KEY;

const JOOBLE_HOST = "jooble.org";

// ── Normalised Job Object ───────────────────────────────────────────────────

/**
 * @typedef {Object} NormalisedJob
 * @property {string}      title
 * @property {string}      company
 * @property {string}      location
 * @property {string}      description
 * @property {string|null} jobUrl
 * @property {string|null} postedDate
 * @property {string|null} salary
 * @property {string|null} employmentType
 */

// ── Jooble Job Provider ─────────────────────────────────────────────────────

async function joobleFetchJobs(role, count = 5) {
  if (!JOOBLE_API_KEY) {
    console.warn(
      "[JOB SEARCH] ⚠️ JOOBLE_API_KEY not set — skipping:",
      role
    );

    return [];
  }

  console.log(
    `[JOB SEARCH] 🔎 Searching Jooble for "${role}"...`
  );

  const path =
  `/api/${encodeURIComponent(JOOBLE_API_KEY)}`;

  const input = {
    keywords: role,
    location: "India",
    page: 1,
    ResultOnPage: Math.min(count, 10),
    companysearch: false
  };

  const response = await httpPost(
    JOOBLE_HOST,
    path,
    input
  );

  if (!response || !Array.isArray(response.jobs)) {
    console.warn(
      "[JOB SEARCH] ⚠️ Jooble returned unexpected data"
    );

    return [];
  }

  console.log(
    `[JOB SEARCH] 📋 Jooble returned ${response.jobs.length} jobs for "${role}"`
  );

  return response.jobs
    .slice(0, count)
    .map((job) => ({
      title:
        job.title ||
        "Unknown Title",

      company:
        job.company ||
        "Unknown Company",

      location:
        job.location ||
        "India",

      description:
        (job.snippet || "")
          .replace(/<[^>]*>/g, "")
          .slice(0, 400)
          .trim(),

      jobUrl:
        isValidUrl(job.link)
          ? job.link
          : null,

      postedDate:
        job.updated ||
        null,

      salary:
        job.salary ||
        null,

      employmentType:
        job.type ||
        null
    }));
}

// ── URL Validation ──────────────────────────────────────────────────────────

function isValidUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

// ── Generic HTTPS POST Helper ────────────────────────────────────────────────

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const options = {
      hostname,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(
      options,
      (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const parsed =
              responseData
                ? JSON.parse(responseData)
                : null;

            if (res.statusCode >= 400) {
              console.error(
                "[JOB SEARCH] ❌ Jooble API error:",
                res.statusCode,
                parsed
              );

              return reject(
                new Error(
                  `Jooble API returned HTTP ${res.statusCode}`
                )
              );
            }

            resolve(parsed);

          } catch (error) {
            reject(
              new Error(
                "Jooble response parse error: " +
                  error.message
              )
            );
          }
        });
      }
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();

      reject(
        new Error(
          "Jooble job search request timed out"
        )
      );
    });

    req.write(data);
    req.end();
  });
}

// ── Active Provider ──────────────────────────────────────────────────────────

const PROVIDER = {
  name: "jooble-india",
  fetchJobs: joobleFetchJobs
};

// ── Public API ───────────────────────────────────────────────────────────────

async function searchJobsByRoles(
  roles,
  jobsPerRole = 4
) {
  console.log(
    `[JOB SEARCH] 🔍 Searching ${PROVIDER.name} for ${roles.length} role(s)...`
  );

  // Search only the top 3 recommended roles.
  const limitedRoles = roles.slice(0, 3);

  const results = await Promise.allSettled(
    limitedRoles.map(async (role) => {
      const jobs =
        await PROVIDER.fetchJobs(
          role,
          jobsPerRole
        );

      console.log(
        `[JOB SEARCH] ✅ "${role}" → ${jobs.length} jobs`
      );

      return {
        role,
        jobs
      };
    })
  );

  return results
  .map((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[JOB SEARCH] ❌ "${limitedRoles[index]}" failed:`,
        result.reason?.message || result.reason
      );
      return null;
    }

    return result.value;
  })
  .filter(Boolean);
}

module.exports = {
  searchJobsByRoles
};
