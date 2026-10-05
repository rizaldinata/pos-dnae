import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseProxyClient } from "@/shared/infrastructure/supabase/proxy-client";

interface RouteRule {
  prefix: string;
  roles: string[];
}

// Aturan akses route (PRD 0.4 bagian 5). Dicek dengan longest-prefix match.
// /pengaturan/users khusus Owner; /pengaturan umum Owner + Admin.
const ROUTE_RULES: RouteRule[] = [
  { prefix: "/pengaturan/users", roles: ["Owner"] },
  { prefix: "/pengaturan", roles: ["Owner", "Admin"] },
  { prefix: "/produk", roles: ["Owner", "Admin"] },
  { prefix: "/stok", roles: ["Owner", "Admin", "Manajer"] },
  { prefix: "/laporan", roles: ["Owner", "Admin", "Manajer"] },
  { prefix: "/kasir", roles: ["Owner", "Admin", "Manajer", "Kasir"] },
];

function matchRule(pathname: string): RouteRule | null {
  let best: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (best === null || rule.prefix.length > best.prefix.length) {
        best = rule;
      }
    }
  }
  return best;
}

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createSupabaseProxyClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";

  if (!user) {
    if (isLoginPage) {
      return supabaseResponse;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // Ambil profil + role untuk pengecekan aktif dan otorisasi route.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, roles ( name )")
    .eq("id", user.id)
    .maybeSingle();

  const roleName = (profile as { roles: { name: string } | null } | null)?.roles
    ?.name;

  if (!profile || (profile as { is_active: boolean }).is_active !== true) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "inactive");
    return NextResponse.redirect(loginUrl);
  }

  const rule = matchRule(pathname);
  if (rule && (!roleName || !rule.roles.includes(roleName))) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/forbidden";
    return NextResponse.redirect(forbiddenUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
