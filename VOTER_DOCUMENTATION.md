# Online Voting System - Voter Documentation

This document explains the **Voter module** in your system exactly as implemented in your codebase (frontend + backend).

## 1. Voter Module Overview

The voter flow is:

1. Voter registers account.
2. Account status becomes `pending`.
3. Admin reviews the voter request:
   - `approved` -> voter can log in
   - `rejected` -> voter cannot log in
4. Approved voter logs in and sees voter dashboard tabs:
   - Dashboard
   - Elections
   - Live Results
   - Final Results
   - Profile
5. Voter can vote **one time per election**.

## 2. Base URL and Session Behavior

- Frontend API base: `VITE_API_BASE_URL` (default: `http://localhost:5010/api`)
- Requests use `credentials: "include"` (cookie-based session auth).
- After login, the backend session identifies the voter on protected routes.

## 3. Voter Authentication & Approval

### 3.1 Register Voter

Endpoint:
- `POST /api/voter/register`

Body:
```json
{
  "name": "Ali Ahmed",
  "email": "ali@example.com",
  "password": "123456"
}
```

Rules:
- `name`, `email`, `password` required
- password min length is 6
- email must be unique
- new voter saved with:
  - `role = user`
  - `approvalStatus = pending`

Result:
- voter created
- pending email notification attempt is returned in response

### 3.2 Login Voter

Endpoint:
- `POST /api/voter/login`

Body:
```json
{
  "email": "ali@example.com",
  "password": "123456"
}
```

Login checks:
- account must exist
- role must be `user`
- approval status must be `approved`
- password must match

Blocked states:
- `pending` -> `"your account is waiting for admin approval"`
- `rejected` -> `"your voter account request was rejected by admin"`

### 3.3 Logout

Endpoint:
- `POST /api/voter/logout`

Destroys voter session.

## 4. Voter Dashboard Tabs (What Each Tab Does)

Frontend file:
- `frontend/src/pages/VoterDashboardPage.jsx`

Tab routes:
- `/voter/dashboard`
- `/voter/elections`
- `/voter/live-results`
- `/voter/final-results`
- `/voter/profile`

### 4.1 Dashboard Tab

Purpose: high-level summary for voter.

Shows:
- Total Elections
- Ongoing elections count
- Ended elections count
- Voted elections count
- Upcoming Hidden count
- Next Upcoming Election card (countdown)
- Bar chart: Votes per Election (visible elections only)

Important behavior:
- Upcoming elections are **hidden** from normal voter election lists until start time.

### 4.2 Elections Tab

Purpose: select election and vote.

Main areas:
- **Election Browser** (left panel)
- **Selected Election Details** (main content)
- **Candidate List** with cards/table switch

Election Browser behavior:
- Lists only visible elections (not upcoming)
- Each election shows status and time label
- Search box filters election list

Candidate list behavior:
- Search candidates by name/email/phone
- View mode toggle:
  - Cards
  - Table
- Vote button states:
  - `Vote Now` (allowed)
  - `Your Vote` (already selected by current voter)
  - `Voted` (voter already voted in this election)
  - `Closed` (election not active)

Ranking behavior:
- Candidate list is sorted by votes (highest first).
- If votes are equal, higher percentage first; then by name.

### 4.3 Live Results Tab

Purpose: real-time updates during/after election.

Features:
- Select election
- Live stat cards:
  - Total Voters
  - Votes Cast
  - Remaining Voters
  - Time Remaining / Completed
- Pie chart + bar chart
- Live ranking table (#, candidate, votes, share, trend)

Realtime source:
- SSE stream from:
  - `/api/polls/:pollId/stream`

### 4.4 Final Results Tab

Purpose: closed-election final outcomes.

Features:
- Dropdown to select closed election
- Final summary cards:
  - Total Votes
  - Total Candidates
  - Winner
  - Election Status
- Final pie chart + bar chart
- Final ranking table

### 4.5 Profile Tab

Purpose: voter account management.

Features:
- Update profile (`name`, `email`)
- Change password (`currentPassword`, `newPassword`)
- Delete account
- Logout

Protected endpoints used:
- `GET /api/voter/me`
- `PATCH /api/voter/me`
- `POST /api/voter/change-password`
- `DELETE /api/voter/me`
- `POST /api/voter/logout`

## 5. Filters (Complete Explanation)

### 5.1 Election Search Filter

Location:
- Elections tab -> Election Browser search input

Matches against:
- election title
- election description
- computed phase text

Notes:
- Applies only to visible elections (`active` and `closed` in UI context)
- Upcoming elections remain hidden from this list

### 5.2 Candidate Search Filter

Location:
- Elections tab -> Candidate List search input

Matches against each candidate:
- name
- email
- phone

After filtering, candidates are still sorted by:
- votes descending
- then percentage descending
- then name ascending

### 5.3 Candidate View Filter (Cards/Table)

Location:
- Elections tab -> Cards / Table buttons

Behavior:
- Changes only presentation, not data source
- Same filtered + sorted candidate set is used in both views

### 5.4 Final Result Election Selector

Location:
- Final Results tab dropdown

Behavior:
- Shows only closed elections
- Loads result data for selected closed election

## 6. Voting Rules (Backend-Enforced)

Endpoint:
- `POST /api/voter/elections/:pollId/vote`

Vote is accepted only when:
- voter is authenticated and role is `user`
- poll exists and not archived
- poll is currently open for voting:
  - status `active`
  - now >= startsAt (if set)
  - now <= endsAt (if set)
- selected competitor is assigned to that poll
- voter has not voted in this poll before

One-vote enforcement:
- `Vote` model has unique index on `{ poll, user }`.
- Duplicate vote returns conflict (`you have already voted in this poll`).

## 7. Election Visibility Rules for Voter

Frontend voter visibility logic:
- `upcoming` -> hidden in visible election lists
- `active` -> shown
- `closed` -> shown

Phase is computed from:
- poll status
- startsAt
- endsAt
- current time

## 8. Main Voter API Endpoints (Quick List)

Account:
- `POST /api/voter/register`
- `POST /api/voter/login`
- `POST /api/voter/logout`
- `GET /api/voter/me`
- `PATCH /api/voter/me`
- `POST /api/voter/change-password`
- `DELETE /api/voter/me`

Elections:
- `GET /api/voter/elections`
- `GET /api/voter/elections/:pollId`
- `GET /api/voter/elections/:pollId/competitors`
- `GET /api/voter/elections/:pollId/results`
- `POST /api/voter/elections/:pollId/vote`

Realtime:
- `GET /api/polls/:pollId/stream`

## 9. Common Errors and Meaning

- `401 invalid email or password` -> wrong credentials
- `403 waiting for admin approval` -> still pending
- `403 rejected by admin` -> admin rejected voter
- `400 poll is not open for voting` -> not active or outside time window
- `400 selected competitor is not assigned to this poll`
- `409 you have already voted in this poll`

## 10. Admin Interaction with Voter Requests

Admin endpoints related to voters:
- `GET /api/voter/admin/registrations?status=...&search=...`
- `PATCH /api/voter/admin/registrations/:voterId`

Allowed approval updates:
- approve/approved
- reject/rejected
- cancel/canceled/cancelled -> treated as rejected

## 11. Practical End-to-End Test Script

1. Register voter.
2. Try login before approval -> expect blocked.
3. Admin approves voter.
4. Login voter.
5. Open Elections tab, search election, open one active election.
6. Search candidate, vote once.
7. Try second vote in same election -> expect conflict.
8. Open Live Results tab -> verify ranking/stream.
9. Open Final Results tab after close -> verify winner and ranking.
10. Update profile and change password.

---

If you want, I can also generate a second file with **Postman-ready request bodies and expected responses** for every voter endpoint.
