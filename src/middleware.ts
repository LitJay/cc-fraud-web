import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the current path is the root path
  if (request.nextUrl.pathname === '/') {
    // Redirect to the login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request to continue if it's not the root path
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/',
};