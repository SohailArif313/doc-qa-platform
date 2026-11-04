import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware(async (auth) => {
  await auth.protect();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};