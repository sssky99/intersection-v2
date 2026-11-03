import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/auth/", "/dev/", "/onboarding/", "/meetings", "/profile", "/gift", "/special-invitation", "/invite/", "/invite-example/", "/feedback/"],
    },
    sitemap: "https://interv2.netlify.app/sitemap.xml",
  };
}
