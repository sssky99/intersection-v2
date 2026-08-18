const nativeAndroidUserAgentToken = "GyojiphapAndroid/";

export function isNativeAndroidRequest(userAgent: string | null | undefined) {
  return userAgent?.includes(nativeAndroidUserAgentToken) === true;
}

export function isNativeRestrictedPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

export function isProductionPreviewPath(pathname: string) {
  return (
    pathname === "/dev" ||
    pathname.startsWith("/dev/") ||
    pathname === "/api/dev" ||
    pathname.startsWith("/api/dev/") ||
    pathname === "/onboarding/questions/preview" ||
    pathname.startsWith("/onboarding/questions/preview/")
  );
}
