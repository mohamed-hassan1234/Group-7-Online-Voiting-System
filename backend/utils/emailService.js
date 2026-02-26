import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "";
const ADMIN_NOTIFICATION_EMAIL = (process.env.ADMIN_NOTIFICATION_EMAIL || "hn4717064@gmail.com")
  .trim()
  .toLowerCase();

let transporter = null;

const isMailConfigured = () => Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM);

const getTransporter = () => {
  if (!isMailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const sendEmail = async ({ to, cc, bcc, subject, text, html }) => {
  try {
    const client = getTransporter();
    if (!client) {
      console.warn("[mail] SMTP not configured. Set SMTP_USER, SMTP_PASS and SMTP_FROM.");
      return { sent: false, reason: "mail_service_not_configured" };
    }

    await client.sendMail({
      from: SMTP_FROM,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (error) {
    console.error("[mail] send failed:", error.message);
    return { sent: false, reason: error.message };
  }
};

const normalizeRecipients = (value) => {
  const items = Array.isArray(value) ? value : [value];
  return [...new Set(
    items
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )];
};

const withNotificationCopy = (email) => {
  const toRecipients = normalizeRecipients(email);
  const ccRecipients = normalizeRecipients(ADMIN_NOTIFICATION_EMAIL).filter(
    (recipient) => !toRecipients.includes(recipient)
  );

  return {
    to: toRecipients.join(", "),
    cc: ccRecipients.join(", "),
  };
};

const formatDateForEmail = (value) => {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const sendVoterPendingApprovalEmail = async ({ name, email }) => {
  const safeName = escapeHtml(name || "Voter");
  const recipients = withNotificationCopy(email);

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: "Voter Registration Received - Waiting for Admin Approval",
    text: `Hello ${name || "Voter"}, your registration is received. Please wait for admin approval before login.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Registration Received</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>Your voter registration was received successfully.</p>
        <p>Please wait for admin approval before you can login and vote.</p>
        <p>We will send another email after admin decision.</p>
      </div>
    `,
  });
};

export const sendVoterDecisionEmail = async ({
  name,
  email,
  status,
  comment,
}) => {
  const safeName = escapeHtml(name || "Voter");
  const safeComment = escapeHtml(comment || "");
  const recipients = withNotificationCopy(email);
  const approved = String(status).toLowerCase() === "approved";
  const decisionTitle = approved ? "Account Approved" : "Account Rejected";
  const decisionLine = approved
    ? "Your voter account is approved. You can now login and vote."
    : "Your voter account request was rejected by admin.";

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `Voter Registration ${approved ? "Approved" : "Rejected"}`,
    text: `Hello ${name || "Voter"}, ${decisionLine}${comment ? ` Note: ${comment}` : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">${decisionTitle}</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>${escapeHtml(decisionLine)}</p>
        ${safeComment ? `<p><strong>Admin note:</strong> ${safeComment}</p>` : ""}
      </div>
    `,
  });
};

export const sendCompetitorAssignedToElectionEmail = async ({
  name,
  email,
  pollTitle,
  startsAt,
  endsAt,
  status,
}) => {
  const safeName = escapeHtml(name || "Competitor");
  const safePollTitle = escapeHtml(pollTitle || "Election");
  const recipients = withNotificationCopy(email);
  const startLabel = formatDateForEmail(startsAt);
  const endLabel = formatDateForEmail(endsAt);
  const safeStatus = escapeHtml(status || "draft");

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `Election Assignment: ${pollTitle || "Election"}`,
    text: `Hello ${name || "Competitor"}, you are assigned to "${pollTitle || "Election"}". Start: ${startLabel}. End: ${endLabel}. Status: ${status || "draft"}.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Election Assignment</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>You are assigned to the election: <strong>${safePollTitle}</strong>.</p>
        <p><strong>Start time:</strong> ${escapeHtml(startLabel)}</p>
        <p><strong>End time:</strong> ${escapeHtml(endLabel)}</p>
        <p><strong>Status:</strong> ${safeStatus}</p>
      </div>
    `,
  });
};

export const sendCompetitorElectionStartedEmail = async ({
  name,
  email,
  pollTitle,
  startsAt,
  endsAt,
  competitors,
}) => {
  const safeName = escapeHtml(name || "Competitor");
  const safePollTitle = escapeHtml(pollTitle || "Election");
  const recipients = withNotificationCopy(email);
  const startLabel = formatDateForEmail(startsAt);
  const endLabel = formatDateForEmail(endsAt);
  const competitorNames = Array.isArray(competitors)
    ? competitors.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const competitorListText = competitorNames.length ? competitorNames.join(", ") : "No competitors listed";
  const competitorListHtml = competitorNames.length
    ? competitorNames.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>No competitors listed</li>";

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `Election Started: ${pollTitle || "Election"}`,
    text:
      `Hello ${name || "Competitor"}, election "${pollTitle || "Election"}" has started.\n` +
      `Start: ${startLabel}\n` +
      `End: ${endLabel}\n` +
      `Competitors: ${competitorListText}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Election Started</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>The election <strong>${safePollTitle}</strong> has started.</p>
        <p><strong>Start time:</strong> ${escapeHtml(startLabel)}</p>
        <p><strong>End time:</strong> ${escapeHtml(endLabel)}</p>
        <p><strong>Competitors in this election:</strong></p>
        <ul>${competitorListHtml}</ul>
      </div>
    `,
  });
};

export const sendCompetitorElectionFinalResultEmail = async ({
  name,
  email,
  pollTitle,
  startsAt,
  endsAt,
  totalVotes,
  rank,
  totalCompetitors,
  votesCount,
  percentage,
  leaderboard,
}) => {
  const safeName = escapeHtml(name || "Competitor");
  const safePollTitle = escapeHtml(pollTitle || "Election");
  const recipients = withNotificationCopy(email);
  const startLabel = formatDateForEmail(startsAt);
  const endLabel = formatDateForEmail(endsAt);
  const rows = Array.isArray(leaderboard) ? leaderboard : [];
  const tableRowsText = rows.length
    ? rows
        .map((row) => `#${row.rank} ${row.name}: ${row.votesCount} vote(s) (${row.percentage}%)`)
        .join("\n")
    : "No result rows";
  const tableRowsHtml = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>
              <td style="padding:6px;border:1px solid #e5e7eb;">${Number(row.rank || 0)}</td>
              <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(row.name || "-")}</td>
              <td style="padding:6px;border:1px solid #e5e7eb;">${Number(row.votesCount || 0)}</td>
              <td style="padding:6px;border:1px solid #e5e7eb;">${Number(row.percentage || 0)}%</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="padding:6px;border:1px solid #e5e7eb;">No results</td></tr>`;

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `Election Final Results: ${pollTitle || "Election"}`,
    text:
      `Hello ${name || "Competitor"}, final result for "${pollTitle || "Election"}".\n` +
      `Start: ${startLabel}\n` +
      `End: ${endLabel}\n` +
      `Your rank: ${rank}/${totalCompetitors}\n` +
      `Your votes: ${votesCount}\n` +
      `Your percentage: ${percentage}%\n` +
      `Total votes: ${totalVotes}\n\n` +
      `All competitors:\n${tableRowsText}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Election Final Results</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>The election <strong>${safePollTitle}</strong> has ended.</p>
        <p><strong>Start time:</strong> ${escapeHtml(startLabel)}</p>
        <p><strong>End time:</strong> ${escapeHtml(endLabel)}</p>
        <p><strong>Your rank:</strong> ${Number(rank || 0)} / ${Number(totalCompetitors || 0)}</p>
        <p><strong>Your votes:</strong> ${Number(votesCount || 0)}</p>
        <p><strong>Your percentage:</strong> ${Number(percentage || 0)}%</p>
        <p><strong>Total votes in election:</strong> ${Number(totalVotes || 0)}</p>
        <p><strong>All competitors ranking:</strong></p>
        <table style="border-collapse: collapse; width: 100%; max-width: 700px;">
          <thead>
            <tr>
              <th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Rank</th>
              <th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Competitor</th>
              <th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Votes</th>
              <th style="padding:6px;border:1px solid #e5e7eb;text-align:left;">Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `,
  });
};

export const sendCompetitorVoteReceivedEmail = async ({
  name,
  email,
  pollTitle,
  votesForCompetitor,
  totalVotes,
  percentage,
  rank,
  totalCompetitors,
}) => {
  const safeName = escapeHtml(name || "Competitor");
  const safePollTitle = escapeHtml(pollTitle || "Election");
  const recipients = withNotificationCopy(email);

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `New Vote Received: ${pollTitle || "Election"}`,
    text:
      `Hello ${name || "Competitor"}, you received a new vote in "${pollTitle || "Election"}". ` +
      `Your votes: ${votesForCompetitor}. Total votes in election: ${totalVotes}. ` +
      `Result: ${percentage}% (Rank ${rank}/${totalCompetitors}).`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">New Vote Received</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>You received a new vote in <strong>${safePollTitle}</strong>.</p>
        <p><strong>Your votes:</strong> ${Number(votesForCompetitor || 0)}</p>
        <p><strong>Total votes in election:</strong> ${Number(totalVotes || 0)}</p>
        <p><strong>Your result:</strong> ${Number(percentage || 0)}%</p>
        <p><strong>Current rank:</strong> ${Number(rank || 0)} / ${Number(totalCompetitors || 0)}</p>
      </div>
    `,
  });
};

export const sendCompetitorElectionCanceledEmail = async ({
  name,
  email,
  pollTitle,
  startsAt,
  endsAt,
  reason,
}) => {
  const safeName = escapeHtml(name || "Competitor");
  const safePollTitle = escapeHtml(pollTitle || "Election");
  const safeReason = escapeHtml(reason || "Canceled by admin.");
  const recipients = withNotificationCopy(email);
  const startLabel = formatDateForEmail(startsAt);
  const endLabel = formatDateForEmail(endsAt);

  return sendEmail({
    to: recipients.to,
    cc: recipients.cc,
    subject: `Election Canceled: ${pollTitle || "Election"}`,
    text:
      `Hello ${name || "Competitor"}, "${pollTitle || "Election"}" has been canceled. ` +
      `Start: ${startLabel}. End: ${endLabel}. Reason: ${reason || "Canceled by admin."}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Election Canceled</h2>
        <p>Hello <strong>${safeName}</strong>,</p>
        <p>The election <strong>${safePollTitle}</strong> has been canceled.</p>
        <p><strong>Start time:</strong> ${escapeHtml(startLabel)}</p>
        <p><strong>End time:</strong> ${escapeHtml(endLabel)}</p>
        <p><strong>Reason:</strong> ${safeReason}</p>
      </div>
    `,
  });
};
