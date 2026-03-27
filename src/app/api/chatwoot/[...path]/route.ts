import { NextRequest, NextResponse } from "next/server";

const chatwootBaseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL;
const chatwootAccountId = process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID;
const chatwootApiToken = process.env.CHATWOOT_API_TOKEN;

const buildChatwootUrl = (request: NextRequest, path: string[]) => {
  const upstreamPath = path.join("/");
  const url = new URL(
    `/api/v1/accounts/${chatwootAccountId}/${upstreamPath}`,
    chatwootBaseUrl,
  );

  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

const proxy = async (request: NextRequest, path: string[]) => {
  if (!chatwootBaseUrl || !chatwootAccountId || !chatwootApiToken) {
    return NextResponse.json(
      { error: "Chatwoot server configuration is missing" },
      { status: 500 },
    );
  }

  const targetUrl = buildChatwootUrl(request, path);
  const method = request.method;
  const contentType = request.headers.get("content-type");

  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers: {
      api_access_token: chatwootApiToken,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body: method === "GET" || method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });

  const upstreamContentType = upstreamResponse.headers.get("content-type") || "";

  if (upstreamContentType.includes("application/json")) {
    const json = await upstreamResponse.json();
    return NextResponse.json(json, { status: upstreamResponse.status });
  }

  const text = await upstreamResponse.text();
  return new NextResponse(text, {
    status: upstreamResponse.status,
    headers: { "Content-Type": upstreamContentType || "text/plain" },
  });
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
