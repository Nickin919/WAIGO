# FREE Users and Admin User Management

This document describes how FREE (guest/downgraded) users are handled and best practices to avoid common issues.

## Problems Addressed

1. **FREE users not visible to admin** – The account/assignments user list excluded `role: FREE`, so downgraded users disappeared from the list.
2. **Same email cannot sign up after downgrade** – The user row still had the email, so registration returned "User with this email already exists".
3. **Downgraded users could still log in** – Only the role was changed to FREE; password was left in place, so they could still sign in.

## Implemented Behavior

### 1. Admin can see FREE users

- **Assignments user list** (`GET /api/assignments/users`): The filter `role: { not: 'FREE' }` was removed. Admins (and RSM/Distributor in scope) now see all users, including FREE. This allows:
  - Viewing downgraded users
  - Re-promoting them (change role back) from the account detail page
  - Searching and managing them like any other user

### 2. Registration reclaims FREE accounts

- **Register** (`POST /api/auth/register`): If an existing user has the same email and **role is FREE**, registration is treated as **reclaim** instead of conflict:
  - The existing user row is updated (new password, firstName, lastName, role set to BASIC by default).
  - No new user is created; the same ID is kept.
  - Response is 200 with user + token (same shape as create).
  - The user can sign up again with the same email and regain access.

- Only **FREE** users can be reclaimed. If the email belongs to a non-FREE user, the API still returns 409.

### 3. Demoting to FREE revokes login

- **Update user role** (`PATCH /api/user-management/:userId/role`): When an admin sets a user’s role to **FREE**:
  - `passwordHash` is set to `null` so the user can no longer log in.
  - Email (and other profile fields) are left as-is so the account can be found and reclaimed later.

So: **Move to FREE** = revoke login and keep the row (and email) for possible reclaim.

## Best Practices (Recommendations)

- **Don’t null email when downgrading to FREE**  
  Keeping the email allows:
  - Admins to find the user in the list (e.g. by search).
  - The same person to re-register with that email and reclaim the account.

- **Optional: role filter in UI**  
  The account list now includes FREE users. Consider adding a "Role" filter (e.g. "Free / Guest" only) so admins can quickly see downgraded accounts.

- **Reclaim and roles**  
  Reclaim sets `role` from the request body (default BASIC). If you need to restrict which roles a reclaimed user can get (e.g. never ADMIN via reclaim), add server-side checks in the reclaim branch of `register`.

- **Anonymous FREE users**  
  Truly anonymous FREE users (created by the public "guest" flow) may have `email: null` and `sessionId` set. They will appear in the admin list if they’re in the subordinate set; search by email won’t find them. You can add a "FREE only" or "No email" filter if you need to manage them separately.

- **Audit trail**  
  For compliance, consider logging when a user is demoted to FREE (and when an account is reclaimed) in an audit table or activity log.
