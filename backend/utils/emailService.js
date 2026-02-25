import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "";

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

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const client = getTransporter();
    if (!client) {
      return { sent: false, reason: "mail_service_not_configured" };
    }

    await client.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
};

export const sendVoterPendingApprovalEmail = async ({ name, email }) => {
  const safeName = escapeHtml(name || "Voter");

  return sendEmail({
    to: email,
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
  const approved = String(status).toLowerCase() === "approved";
  const decisionTitle = approved ? "Account Approved" : "Account Rejected";
  const decisionLine = approved
    ? "Your voter account is approved. You can now login and vote."
    : "Your voter account request was rejected by admin.";

  return sendEmail({
    to: email,
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
