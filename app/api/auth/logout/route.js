import { NextResponse } from "next/server";

function handleCORS(response) {
  response.headers.set("Access-Control-Allow-Origin", process.env.CORS_ORIGINS || "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }));
}

export async function POST() {
  const res = NextResponse.json({ success: true });

  // حذف الكوكي بشكل مؤكد
  res.cookies.set({
    name: "solmate_session",
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  res.cookies.set("solmate_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return handleCORS(res);
}

export async function GET() {
  return POST();
}
