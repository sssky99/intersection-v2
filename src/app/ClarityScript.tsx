"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { CLARITY_PROJECT_ID, trackAnalyticsPageView } from "@/lib/analytics";

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname.endsWith(".localhost")
  );
}

function isAdminPath(pathname: string | null) {
  return pathname === "/admin" || pathname?.startsWith("/admin/") === true;
}

export function ClarityScript() {
  const pathname = usePathname();
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    setCanLoad(
      process.env.NODE_ENV === "production" &&
        !isLocalHostname(window.location.hostname),
    );
  }, []);

  useEffect(() => {
    if (!canLoad || isAdminPath(pathname)) return;
    trackAnalyticsPageView();
  }, [canLoad, pathname]);

  if (!CLARITY_PROJECT_ID || !canLoad || isAdminPath(pathname)) {
    return null;
  }

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", ${JSON.stringify(CLARITY_PROJECT_ID)});
      `}
    </Script>
  );
}
