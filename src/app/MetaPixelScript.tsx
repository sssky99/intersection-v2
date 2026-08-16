"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { META_PIXEL_ID } from "@/lib/analytics";

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

export function MetaPixelScript() {
  const pathname = usePathname();
  const initialPageViewHandled = useRef(false);
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    setCanLoad(
      process.env.NODE_ENV === "production" &&
        !isLocalHostname(window.location.hostname),
    );
  }, []);

  useEffect(() => {
    if (!canLoad || isAdminPath(pathname)) return;

    if (!initialPageViewHandled.current) {
      initialPageViewHandled.current = true;
      return;
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [canLoad, pathname]);

  if (!META_PIXEL_ID || !canLoad || isAdminPath(pathname)) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', ${JSON.stringify(META_PIXEL_ID)});
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
