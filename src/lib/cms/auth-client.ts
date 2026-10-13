'use client';

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/plugins/two-factor';

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
