// ═══════════════════════════════════════════════════════════════════════════════
//  KRUTANIC — 6-Month Placement Acceleration Program
//  Google Apps Script — Sheet Logger + Branded Confirmation Email
//
//  SETUP (3 steps):
//  1. Open Google Sheet → Extensions → Apps Script → paste this file
//  2. Deploy → New Deployment → Web App → Execute as Me → Access: Anyone → Copy URL
//  3. Paste that URL into krutanic-enrollment.html as SHEET_URL
//  Run setupSheet() ONCE manually to initialise headers
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONFIG — edit these values ───────────────────────────────────────────────
const CONFIG = {
  SHEET_NAME:     "Applications",
  SENDER_NAME:    "Krutanic Solutions",
  SENDER_EMAIL:   "ranjan@krutanic.org",       // Must be a Gmail alias you own
  REPLY_TO:       "info@krutanic.org",
  WEBSITE:        "https://www.krutanic.com",
  ADVANCE_URL:    "https://www.krutanic.com/Advance",
  MENTORSHIP_URL: "https://www.krutanic.com/Mentorship",
  WHATSAPP_URL:   "https://chat.whatsapp.com/EJJJw5lXcgoCc1WAvES9fb",
  COORDINATOR:    "Dr. Mandeep Singh",
  COORD_ROLE:     "Placements Controller, Krutanic Solutions",
  COORD_PHONE:    "+91 8105954318",
  YEAR:           "2026"
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Sheet column headers (matches writeToSheet order exactly) ────────────────
const HEADERS = [
  "Timestamp", "Application ID", "Full Name", "Email", "Phone", "WhatsApp",
  "Language(s)", "Preferred Contact Time", "Current Situation",
  "Career Goal", "Current Challenge", "Domain of Interest",
  "Why Interested", "Start Timeline", "Why Important",
  "Investment Ready", "Commitment Level", "Paid Acknowledged"
];


// ════════════════════════════════════════════════════════════════════════════
//  doPost — entry point for form submissions
// ════════════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : null;
    if (!raw) return jsonResp({ status: "error", message: "No data received" });

    const data  = JSON.parse(raw);

    // ── SECURITY & ANTI-SPAM VALIDATIONS ──────────────────────────────────────
    const expectedToken = "KRU_SECURE_" + new Date().getFullYear();
    const timeToFill = data.formLoadTime ? (Date.now() - data.formLoadTime) : 0;
    
    if (
      data.securityToken !== expectedToken ||       // 1. Invalid or missing token
      (data.botHoneypot && data.botHoneypot !== "") || // 2. Honeypot filled by bot
      timeToFill < 3000 ||                          // 3. Submitted instantly (< 3s)
      (data.fullName && /(http|www|<a)/i.test(data.fullName)) // 4. URL in Name field
    ) {
      Logger.log("BLOCKED SPAM/BOT. Token: " + data.securityToken + " | Honeypot: " + data.botHoneypot + " | Time: " + timeToFill);
      // Return fake success so bots don't adapt
      return jsonResp({ status: "ok", appId: "KRU-BLOCKED-BOT" });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const appId = generateAppId();

    writeToSheet(data, appId);

    if (data.email) {
      sendConfirmationEmail(data, appId);
    }

    return jsonResp({ status: "ok", appId: appId });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResp({ status: "error", message: err.toString() });
  }
}

// Health-check endpoint
function doGet() {
  return jsonResp({ status: "ok", message: "Krutanic enrollment endpoint is live" });
}


// ════════════════════════════════════════════════════════════════════════════
//  writeToSheet — logs form data to Google Sheet
// ════════════════════════════════════════════════════════════════════════════
function writeToSheet(data, appId) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    applyHeaderStyle(sheet);
    sheet.setFrozenRows(1);
  }

  const ts = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  // Field names match the HTML submitForm() data object exactly
  sheet.appendRow([
    ts,
    appId,
    data.fullName      || "",
    data.email         || "",
    data.phone         || "",
    data.whatsapp      || "",
    data.language      || "",
    data.timeConnect   || "",
    data.situation     || "",
    data.careerGoal    || "",
    data.challenges    || "",
    data.domain        || "",
    data.whyInterested || "",
    data.startWhen     || "",
    data.whyImportant  || "",
    data.investReady   || "",
    data.seriousness   || "",
    data.paidAck       || "Acknowledged"
  ]);

  sheet.autoResizeColumns(1, HEADERS.length);
}


// ════════════════════════════════════════════════════════════════════════════
//  sendConfirmationEmail
// ════════════════════════════════════════════════════════════════════════════
function sendConfirmationEmail(data, appId) {
  const firstName = (data.fullName || "Learner").split(" ")[0];
  const subject   = "Application Confirmed — Krutanic Placement Program [" + appId + "]";

  GmailApp.sendEmail(
    data.email,
    subject,
    buildPlainText(firstName, appId),
    {
      htmlBody:  buildEmailHtml(data, appId, firstName),
      name:      CONFIG.SENDER_NAME,
      replyTo:   CONFIG.REPLY_TO,
      // Anti-spam headers
      noReply:   false
    }
  );

  Logger.log("Email sent → " + data.email + " | AppID: " + appId);
}


// ════════════════════════════════════════════════════════════════════════════
//  buildPlainText — plain-text fallback (critical for spam score)
// ════════════════════════════════════════════════════════════════════════════
function buildPlainText(firstName, appId) {
  return [
    "Hi " + firstName + ",",
    "",
    "Your application for the Krutanic 6-Month Placement Acceleration Program has been received.",
    "",
    "Application ID: " + appId,
    "",
    "WHAT HAPPENS NEXT",
    "1. Our counsellor will call/WhatsApp you within 24 hours.",
    "2. Program orientation details will be shared within 2-3 days.",
    "3. A dedicated mentor will be assigned to guide your 6-month journey.",
    "4. Live training sessions begin from Month 1 — 5 days/week.",
    "",
    "For any questions, reply to this email or contact us at " + CONFIG.REPLY_TO,
    "",
    "Warm regards,",
    CONFIG.COORDINATOR,
    CONFIG.COORD_ROLE,
    CONFIG.COORD_PHONE,
    CONFIG.WEBSITE,
    "",
    "---",
    "© " + CONFIG.YEAR + " Krutanic Solutions | " + CONFIG.WEBSITE,
    "You received this because you applied at krutanic.com/Advance",
    "To unsubscribe, reply with 'unsubscribe' in the subject line."
  ].join("\n");
}


// ════════════════════════════════════════════════════════════════════════════
//  buildEmailHtml — full branded HTML email (Krutanic red/black theme)
// ════════════════════════════════════════════════════════════════════════════
function buildEmailHtml(data, appId, firstName) {

  const domainDisplay = data.domain || "Selected Program";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <title>Application Confirmed — Krutanic</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body { margin:0; padding:0; background:#f4f4f4; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:#e8421a; text-decoration:none; }
    @media only screen and (max-width:620px) {
      .email-wrap { width:100% !important; }
      .mobile-pad { padding:24px 18px !important; }
      .stat-cell { display:inline-block !important; width:49% !important; padding:16px 0 !important; box-sizing:border-box !important; border-bottom:1px solid rgba(255,255,255,0.2) !important; }
      .stat-cell:nth-child(even) { border-right:none !important; }
      .stat-cell:nth-child(3), .stat-cell:nth-child(4) { border-bottom:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">

<!-- PREHEADER (invisible preview text — boosts deliverability) -->
<div style="display:none;font-size:1px;color:#f4f4f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Hi ${firstName}, your application for the Krutanic Placement Acceleration Program is confirmed. App ID: ${appId}
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<!-- OUTER WRAPPER -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">

<!-- EMAIL CARD (max 600px) -->
<table class="email-wrap" width="600" cellpadding="0" cellspacing="0" role="presentation"
  style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;
         box-shadow:0 4px 24px rgba(0,0,0,0.10);">

  <!-- TOP ACCENT BAR -->
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,#e8421a 0%,#c23010 50%,#e8421a 100%);"></td>
  </tr>

  <!-- ── HEADER ─────────────────────────────────────────────────────── -->
  <tr>
    <td align="center" class="mobile-pad"
      style="padding:36px 40px 28px;background:#111111;">

      <!-- Logo text side-by-side (matching website) -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
        <tr>
          <td align="right" style="padding-right:12px; vertical-align:middle;">
            <!-- K monogram -->
            <div style="width:48px;height:48px;border-radius:50%;
                        border:2.5px solid #e8421a;background:#1a1a1a;
                        text-align:center;line-height:48px;
                        font-size:20px;font-weight:900;color:#e8421a;
                        font-family:'Segoe UI',Arial,sans-serif;">K</div>
          </td>
          <td align="left" style="vertical-align:middle;">
            <div style="font-size:22px;font-weight:900;color:#ffffff;
                        letter-spacing:2px;text-transform:uppercase;
                        font-family:'Segoe UI',Arial,sans-serif;line-height:1;">KRUTANIC</div>
            <div style="font-size:8px;font-weight:700;color:#e8421a;
                        letter-spacing:2.5px;text-transform:uppercase;
                        font-family:'Segoe UI',Arial,sans-serif;margin-top:4px;">A Ladder For Brighter Future</div>
          </td>
        </tr>
      </table>

      <!-- Confirmed badge -->
      <div style="display:inline-block;margin-top:22px;
                  background:rgba(232,66,26,0.15);
                  border:1px solid rgba(232,66,26,0.4);
                  border-radius:100px;padding:7px 22px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:2px;
                     text-transform:uppercase;color:#e8421a;">
          Application Confirmed
        </span>
      </div>

      <h1 style="margin:16px 0 6px;font-size:26px;font-weight:800;
                 color:#ffffff;letter-spacing:-0.5px;
                 font-family:'Segoe UI',Arial,sans-serif;">
        You're in, ${firstName}! &#127881;
      </h1>
      <p style="margin:0;font-size:14px;color:#aaaaaa;line-height:1.7;">
        Your application for the<br>
        <strong style="color:#ffffff;">6-Month Placement Acceleration Program</strong><br>
        has been successfully received.
      </p>
    </td>
  </tr>

  <!-- ── APP ID STRIP ────────────────────────────────────────────────── -->
  <tr>
    <td align="center" style="padding:20px 40px;background:#1a1a1a;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="background:#111111;border:1.5px solid rgba(232,66,26,0.5);
                     border-radius:100px;padding:10px 28px;text-align:center;">
            <span style="font-size:11px;font-weight:600;letter-spacing:1px;
                         text-transform:uppercase;color:#aaaaaa;">Application ID &nbsp;</span>
            <span style="font-size:15px;font-weight:900;color:#e8421a;letter-spacing:2px;">
              ${appId}
            </span>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#666666;">
        Save this ID for all future correspondence with our team
      </p>
    </td>
  </tr>

  <!-- ── STATS ROW ───────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:0;background:#e8421a;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td class="stat-cell" align="center"
              style="padding:18px 10px;border-right:1px solid rgba(255,255,255,0.2);width:25%;">
            <div style="font-size:22px;font-weight:900;color:#ffffff;
                        font-family:'Segoe UI',Arial,sans-serif;line-height:1;">6</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);
                        text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Months</div>
          </td>
          <td class="stat-cell" align="center"
              style="padding:18px 10px;border-right:1px solid rgba(255,255,255,0.2);width:25%;">
            <div style="font-size:22px;font-weight:900;color:#ffffff;
                        font-family:'Segoe UI',Arial,sans-serif;line-height:1;">4</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);
                        text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Phases</div>
          </td>
          <td class="stat-cell" align="center"
              style="padding:18px 10px;border-right:1px solid rgba(255,255,255,0.2);width:25%;">
            <div style="font-size:22px;font-weight:900;color:#ffffff;
                        font-family:'Segoe UI',Arial,sans-serif;line-height:1;">500+</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);
                        text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Companies</div>
          </td>
          <td class="stat-cell" align="center"
              style="padding:18px 10px;width:25%;">
            <div style="font-size:22px;font-weight:900;color:#ffffff;
                        font-family:'Segoe UI',Arial,sans-serif;line-height:1;">1:1</div>
            <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);
                        text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Mentorship</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── APPLICATION SUMMARY ─────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:32px 40px 0;">
      <h2 style="margin:0 0 16px;font-size:12px;font-weight:800;
                 letter-spacing:2.5px;text-transform:uppercase;color:#e8421a;
                 font-family:'Segoe UI',Arial,sans-serif;">
        Application Summary
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="border:1.5px solid #eeeeee;border-radius:10px;overflow:hidden;">
        ${summaryRow("Full Name",    data.fullName,    true)}
        ${summaryRow("Email",        data.email,       false)}
        ${summaryRow("Phone",        data.phone,       true)}
        ${summaryRow("WhatsApp",     data.whatsapp,    false)}
        ${summaryRow("Domain",       domainDisplay,    true)}
        ${summaryRow("Language(s)",  data.language,    false)}
        ${summaryRow("Commitment",   data.seriousness, true)}
        ${summaryRow("Start Plan",   data.startWhen,   false)}
        ${summaryRow("App ID",       appId,            true)}
      </table>
    </td>
  </tr>

  <!-- ── WHAT HAPPENS NEXT ───────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:32px 40px 0;">
      <h2 style="margin:0 0 18px;font-size:12px;font-weight:800;
                 letter-spacing:2.5px;text-transform:uppercase;color:#e8421a;
                 font-family:'Segoe UI',Arial,sans-serif;">
        What Happens Next
      </h2>
      ${nextStep("1","Call Within 24 Hours",
        "Our counsellor will personally reach out on WhatsApp & phone to discuss the program details, fee structure, and answer all your questions.")}
      ${nextStep("2","Orientation in 2–3 Days",
        "Your complete orientation schedule and program kickoff details will be shared on WhatsApp and email.")}
      ${nextStep("3","Mentor Assignment",
        "A dedicated industry mentor will be assigned to guide you through the full 6-month journey.")}
      ${nextStep("4","Month 1 — Core Training Begins",
        "Live instructor-led sessions, 5 days/week. Industry-aligned curriculum starts from Day 1.")}
    </td>
  </tr>

  <!-- ── PROGRAM PHASES ──────────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:32px 40px 0;">
      <h2 style="margin:0 0 16px;font-size:12px;font-weight:800;
                 letter-spacing:2.5px;text-transform:uppercase;color:#e8421a;
                 font-family:'Segoe UI',Arial,sans-serif;">
        Your 6-Month Roadmap
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f9f9f9;border:1.5px solid #eeeeee;border-radius:10px;overflow:hidden;">
        ${phaseRow("Phase I",   "Months 1–3", "Advanced Core Training",    "Live sessions 5 days/week · 1:1 mentoring · Evaluations")}
        ${phaseRow("Phase II",  "Month 4",    "Practical Implementation",  "Real assignments · Resume structuring · Interview groundwork")}
        ${phaseRow("Phase III", "Month 5",    "Corporate Internship",       "Real-time projects · Performance review · Certification")}
        ${phaseRow("Phase IV",  "Month 6",    "Placement Acceleration",     "Mock interviews · Direct scheduling · Offer negotiation")}
      </table>
    </td>
  </tr>

  <!-- ── GUARANTEE BANNER ────────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:28px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#111111;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:28px;width:40px;padding-right:14px;vertical-align:top;
                           padding-top:2px;">&#128737;</td>
                <td>
                  <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:5px;
                              font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-0.2px;">
                    100% Placement Guarantee
                  </div>
                  <div style="font-size:12px;color:#aaaaaa;line-height:1.6;">
                    Every graduate receives dedicated placement support, Fortune 500 referrals,
                    and full mock interview preparation. We do not stop until you are placed.
                  </div>
                  <div style="margin-top:12px;">
                    ${badge("100% Placement")}
                    ${badge("Real Internship")}
                    ${badge("Certified")}
                    ${badge("1:1 Mentorship")}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── WHATSAPP CTA ────────────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:28px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f0fff5;border:1.5px solid #bbf7d0;border-radius:10px;">
        <tr>
          <td align="center" style="padding:20px 24px;">
            <div style="font-size:15px;font-weight:800;color:#15803d;margin-bottom:6px;
                        font-family:'Segoe UI',Arial,sans-serif;">
              Join the Batch WhatsApp Channel
            </div>
            <div style="font-size:13px;color:#555555;margin-bottom:16px;line-height:1.5;">
              Connect with batchmates and get instant program updates
            </div>
            <a href="${CONFIG.WHATSAPP_URL}"
               style="display:inline-block;background:#25D366;color:#ffffff;
                      text-decoration:none;font-size:13px;font-weight:700;
                      padding:11px 30px;border-radius:100px;
                      font-family:'Segoe UI',Arial,sans-serif;
                      letter-spacing:0.3px;">
              Join Channel →
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── COORDINATOR ─────────────────────────────────────────────────── -->
  <tr>
    <td class="mobile-pad" style="padding:28px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f9f9f9;border:1.5px solid #eeeeee;border-radius:10px;">
        <tr>
          <td style="padding:20px 22px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:46px;padding-right:14px;vertical-align:top;">
                  <div style="width:44px;height:44px;border-radius:50%;
                              background:#e8421a;text-align:center;line-height:44px;
                              font-size:18px;font-weight:900;color:#ffffff;
                              font-family:'Segoe UI',Arial,sans-serif;">M</div>
                </td>
                <td>
                  <div style="font-size:14px;font-weight:800;color:#111111;
                              font-family:'Segoe UI',Arial,sans-serif;">${CONFIG.COORDINATOR}</div>
                  <div style="font-size:12px;color:#888888;margin-top:2px;">${CONFIG.COORD_ROLE}</div>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:#eeeeee;margin:14px 0;"></div>
            <div style="font-size:12px;color:#555555;line-height:1.7;">
              &#128222;&nbsp; ${CONFIG.COORD_PHONE}
              &nbsp;&nbsp;&#8226;&nbsp;&nbsp;
              &#9993;&nbsp; <a href="mailto:${CONFIG.REPLY_TO}"
                              style="color:#e8421a;text-decoration:none;">${CONFIG.REPLY_TO}</a>
            </div>
            <div style="font-size:12px;margin-top:4px;">
              <a href="${CONFIG.WEBSITE}"
                 style="color:#e8421a;text-decoration:none;">${CONFIG.WEBSITE}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── FOOTER ──────────────────────────────────────────────────────── -->
  <tr>
    <td align="center" style="padding:24px 40px;background:#111111;
                               border-top:1px solid #222222;">
      <!-- Logo text side-by-side (matching website) -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
        <tr>
          <td align="right" style="padding-right:10px; vertical-align:middle;">
            <!-- K monogram small -->
            <div style="width:36px;height:36px;border-radius:50%;
                        border:2px solid #e8421a;background:#1a1a1a;
                        text-align:center;line-height:36px;
                        font-size:15px;font-weight:900;color:#e8421a;
                        font-family:'Segoe UI',Arial,sans-serif;">K</div>
          </td>
          <td align="left" style="vertical-align:middle;">
            <div style="font-size:14px;font-weight:800;color:#ffffff;letter-spacing:2px;
                        text-transform:uppercase;font-family:'Segoe UI',Arial,sans-serif;
                        line-height:1;">KRUTANIC</div>
            <div style="font-size:7px;font-weight:700;color:#e8421a;letter-spacing:2px;
                        text-transform:uppercase;font-family:'Segoe UI',Arial,sans-serif;
                        margin-top:2px;">A Ladder For Brighter Future</div>
          </td>
        </tr>
      </table>

      <div style="font-size:11px;color:#555555;line-height:1.8;margin-bottom:10px;">
        <a href="${CONFIG.WEBSITE}" style="color:#888888;text-decoration:none;">${CONFIG.WEBSITE}</a>
        &nbsp;&#8226;&nbsp;
        Ref: ${appId}
      </div>
      <div style="font-size:11px;color:#444444;line-height:1.7;">
        &copy; ${CONFIG.YEAR} Krutanic Solutions. All rights reserved.<br>
        You received this because you applied at
        <a href="${CONFIG.ADVANCE_URL}" style="color:#e8421a;text-decoration:none;">krutanic.com/Advance</a>.<br>
        To stop receiving emails, reply with <em>unsubscribe</em> in the subject line.
      </div>
    </td>
  </tr>

  <!-- BOTTOM ACCENT BAR -->
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,#e8421a 0%,#c23010 50%,#e8421a 100%);"></td>
  </tr>

</table>
<!-- /EMAIL CARD -->

</td></tr>
</table>
<!-- /OUTER WRAPPER -->

</body>
</html>`;
}


// ════════════════════════════════════════════════════════════════════════════
//  EMAIL COMPONENT HELPERS
// ════════════════════════════════════════════════════════════════════════════

function summaryRow(label, value, shaded) {
  const bg = shaded ? "background:#f9f9f9;" : "background:#ffffff;";
  return `<tr>
    <td style="${bg}padding:11px 16px;font-size:12px;color:#888888;width:38%;
                border-bottom:1px solid #f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
      ${label}
    </td>
    <td style="${bg}padding:11px 16px;font-size:12px;font-weight:700;color:#111111;
                border-bottom:1px solid #f0f0f0;font-family:'Segoe UI',Arial,sans-serif;">
      ${value || "—"}
    </td>
  </tr>`;
}

function nextStep(num, title, desc) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="margin-bottom:12px;">
    <tr>
      <td width="32" valign="top" style="padding-top:1px;">
        <div style="width:28px;height:28px;border-radius:50%;background:#e8421a;
                    text-align:center;line-height:28px;font-size:13px;font-weight:800;
                    color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;">${num}</div>
      </td>
      <td style="padding-left:12px;">
        <div style="font-size:14px;font-weight:700;color:#111111;margin-bottom:3px;
                    font-family:'Segoe UI',Arial,sans-serif;">${title}</div>
        <div style="font-size:12px;color:#666666;line-height:1.6;
                    font-family:'Segoe UI',Arial,sans-serif;">${desc}</div>
      </td>
    </tr>
  </table>`;
}

function phaseRow(phase, period, title, details) {
  return `<tr>
    <td style="padding:13px 16px;border-bottom:1px solid #eeeeee;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="64">
            <div style="background:#e8421a;color:#ffffff;border-radius:6px;
                        padding:4px 8px;font-size:10px;font-weight:800;
                        text-align:center;letter-spacing:0.5px;
                        font-family:'Segoe UI',Arial,sans-serif;">${phase}</div>
            <div style="font-size:10px;color:#aaaaaa;text-align:center;
                        margin-top:3px;font-family:'Segoe UI',Arial,sans-serif;">${period}</div>
          </td>
          <td style="padding-left:14px;">
            <div style="font-size:13px;font-weight:700;color:#111111;margin-bottom:2px;
                        font-family:'Segoe UI',Arial,sans-serif;">${title}</div>
            <div style="font-size:11px;color:#888888;line-height:1.5;
                        font-family:'Segoe UI',Arial,sans-serif;">${details}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function badge(text) {
  return `<span style="display:inline-block;background:rgba(232,66,26,0.15);
                       border:1px solid rgba(232,66,26,0.35);color:#e8421a;
                       font-size:10px;font-weight:700;padding:3px 10px;
                       border-radius:100px;margin:3px 4px 3px 0;
                       font-family:'Segoe UI',Arial,sans-serif;
                       text-transform:uppercase;letter-spacing:0.5px;">&#10003; ${text}</span>`;
}


// ════════════════════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ════════════════════════════════════════════════════════════════════════════

function applyHeaderStyle(sheet) {
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length)
       .setFontWeight("bold")
       .setBackground("#111111")
       .setFontColor("#e8421a")
       .setFontSize(11);
  sheet.setFrozenRows(1);
}


// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function generateAppId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return "KRU-" + ts + "-" + rand;
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════════════════════════════════════════
//  RUN ONCE — initialises sheet with styled headers
// ════════════════════════════════════════════════════════════════════════════
function setupSheet() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (sheet) {
    Logger.log("Sheet already exists: " + CONFIG.SHEET_NAME);
    return;
  }

  sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  applyHeaderStyle(sheet);

  const widths = [160,170,150,200,120,120,130,170,180,200,200,250,280,150,280,200,130,120];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  Logger.log("Sheet '" + CONFIG.SHEET_NAME + "' created with styled headers.");
}


// ════════════════════════════════════════════════════════════════════════════
//  TEST — sends a test email to your own Gmail account
// ════════════════════════════════════════════════════════════════════════════
function testEmail() {
  const mockData = {
    fullName:      "Priya Sharma",
    email:         Session.getActiveUser().getEmail(),
    phone:         "+91 98765 43210",
    whatsapp:      "+91 98765 43210",
    language:      "English, Hindi",
    timeConnect:   "Evening (6pm–8pm)",
    situation:     "Recent Graduate (0–1 year)",
    careerGoal:    "Get my first job",
    challenges:    "Not getting interview calls",
    domain:        "Software Engineering",
    whyInterested: "I want guaranteed placement support to land my first job",
    startWhen:     "Immediately (Ready to start now)",
    whyImportant:  "I want practical skills and job-readiness ASAP",
    investReady:   "Yes, I'm ready",
    seriousness:   "100% committed",
    paidAck:       "Acknowledged"
  };

  const appId = generateAppId();
  Logger.log("Test App ID: " + appId);
  sendConfirmationEmail(mockData, appId);
  Logger.log("Test email sent to: " + mockData.email);
}
