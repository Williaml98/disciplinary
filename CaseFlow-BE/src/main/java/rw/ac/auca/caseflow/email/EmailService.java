package rw.ac.auca.caseflow.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Every outgoing email in the system renders through the one branded shell in
 * {@link #wrapInTemplate}: AUCA logo header, navy accent, single column, optional call-to-action
 * button, committee sign-off. Callers supply body fragments built with the helpers here
 * ({@link #paragraph}, {@link #heading}, {@link #detailTable}, {@link #button}) rather than
 * hand-writing HTML, so no message can drift away from the shared design.
 *
 * <p>Sends are best-effort: {@link #sendHtml} swallows and logs failures so a broken or unreachable
 * SMTP server can never break the underlying case or user action that triggered the notification.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String NAVY = "#1D3A5F";
    private static final String ACCENT = "#9CC7EE";
    private static final String CREAM = "#f0ead9";
    private static final String LOGO_RESOURCE = "branding/logo.png";
    private static final String LOGO_CID = "auca-logo";

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String appUrl;

    public EmailService(JavaMailSender mailSender,
                        @Value("${caseflow.mail.from}") String fromAddress,
                        @Value("${caseflow.app-url}") String appUrl) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.appUrl = appUrl;
    }

    // ---- Public message types ----

    /**
     * Adapter for plain-text callers: blank-line-separated paragraphs become the branded shell, with a
     * "Log in to CaseFlow" call to action. Kept so a caller with nothing but prose stays a one-liner.
     */
    public void send(String to, String subject, String body) {
        String bodyHtml = Arrays.stream(body.strip().split("\n\n"))
                .map(p -> paragraph(p.strip()))
                .collect(Collectors.joining())
                + button("Log in to CaseFlow", appUrl);
        sendHtml(to, subject, bodyHtml);
    }

    /** Case notification with a structured detail table — used for decision/appeal/reintegration notices. */
    public void sendCaseNotification(String to, String subject, String headline, String intro,
                                     Map<String, String> details, String closing) {
        StringBuilder body = new StringBuilder()
                .append(heading(headline))
                .append(paragraph(intro))
                .append(detailTable(details));
        if (closing != null && !closing.isBlank()) {
            body.append(paragraph(closing));
        }
        body.append(button("View your case in CaseFlow", appUrl));
        sendHtml(to, subject, body.toString());
    }

    public void sendOtpCode(String to, String code) {
        sendHtml(to, "Your CaseFlow verification code", otpEmailBody(
                "Verify your email",
                "Use the code below to verify your email and finish creating your CaseFlow account.", code,
                "This code expires in 10 minutes. If you didn't request it, you can safely ignore this email."));
    }

    public void sendPasswordResetCode(String to, String code) {
        sendHtml(to, "Reset your CaseFlow password", otpEmailBody(
                "Reset your password",
                "Use the code below to reset your CaseFlow password.", code,
                "This code expires in 10 minutes. If you didn't request a password reset, "
                        + "you can safely ignore this email — your password will stay unchanged."));
    }

    /**
     * Sent when an admin creates an account. The temporary password is generated server-side and is
     * only ever shown here; the account is flagged so CaseFlow forces a change at first sign-in.
     */
    public void sendWelcome(String to, String name, String roleLabel, String temporaryPassword) {
        Map<String, String> credentials = new LinkedHashMap<>();
        credentials.put("Email", to);
        credentials.put("Temporary password", temporaryPassword);
        credentials.put("Role", roleLabel);

        String body = heading("Welcome to CaseFlow, " + name)
                + paragraph("An account has been created for you on CaseFlow, the AUCA disciplinary "
                        + "case management system. Sign in with the details below.")
                + detailTable(credentials)
                + calloutParagraph("For your security, you'll be asked to choose a new password the first "
                        + "time you sign in. This temporary password can only be used once.")
                + button("Sign in to CaseFlow", appUrl);
        sendHtml(to, "Your CaseFlow account is ready", body);
    }

    /** Sent when an admin deactivates an account, so the user isn't left guessing at the login screen. */
    public void sendAccountDeactivated(String to, String name) {
        String body = heading("Your CaseFlow access has been paused")
                + paragraph("Hello " + name + ",")
                + paragraph("Your CaseFlow account has been deactivated by an administrator, so you will "
                        + "not be able to sign in for the time being.")
                + paragraph("If you believe this is a mistake, please contact the Registrar's office.");
        sendHtml(to, "Your CaseFlow account has been deactivated", body);
    }

    /** Sent when an admin restores access. */
    public void sendAccountReactivated(String to, String name) {
        String body = heading("Your CaseFlow access has been restored")
                + paragraph("Hello " + name + ",")
                + paragraph("Your CaseFlow account has been reactivated. You can sign in again using your "
                        + "existing password.")
                + button("Sign in to CaseFlow", appUrl);
        sendHtml(to, "Your CaseFlow account has been reactivated", body);
    }

    // ---- Body fragment builders ----

    public static String heading(String text) {
        return "<h1 style=\"margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:" + NAVY + ";\">"
                + escapeHtml(text) + "</h1>";
    }

    public static String paragraph(String text) {
        return "<p style=\"margin:0 0 16px;\">" + escapeHtml(text).replace("\n", "<br>") + "</p>";
    }

    private static String calloutParagraph(String text) {
        return "<p style=\"margin:0 0 16px;padding:12px 14px;background:" + CREAM + ";border-radius:10px;"
                + "font-size:13px;color:#4b5563;\">" + escapeHtml(text) + "</p>";
    }

    /** Label/value rows. Rendered as a table so it survives email clients that strip flexbox/grid. */
    private static String detailTable(Map<String, String> details) {
        if (details == null || details.isEmpty()) {
            return "";
        }
        String rows = details.entrySet().stream()
                .filter(e -> e.getValue() != null && !e.getValue().isBlank())
                .map(e -> "<tr>"
                        + "<td style=\"padding:8px 0;color:#6b7280;font-size:13px;\">" + escapeHtml(e.getKey()) + "</td>"
                        + "<td style=\"padding:8px 0;text-align:right;font-weight:600;color:#1f2937;font-size:13px;\">"
                        + escapeHtml(e.getValue()) + "</td></tr>")
                .collect(Collectors.joining());
        if (rows.isEmpty()) {
            return "";
        }
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"margin:0 0 20px;border-top:1px solid #eee;border-bottom:1px solid #eee;\">"
                + rows + "</table>";
    }

    /** Bulletproof-ish CTA: a padded anchor, which every major client renders without VML. */
    private static String button(String label, String href) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 4px;\">"
                + "<tr><td style=\"background:" + NAVY + ";border-radius:10px;\">"
                + "<a href=\"" + escapeAttribute(href) + "\" style=\"display:inline-block;padding:12px 24px;"
                + "color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;\">"
                + escapeHtml(label) + "</a></td></tr></table>";
    }

    private static String otpEmailBody(String headline, String introText, String code, String footerText) {
        return heading(headline)
                + paragraph(introText)
                + "<div style=\"text-align:center;margin:0 0 20px;\">"
                + "<span style=\"display:inline-block;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:32px;font-weight:700;"
                + "letter-spacing:8px;color:" + NAVY + ";background:" + CREAM + ";border:1px solid #e0d6bb;"
                + "border-radius:12px;padding:16px 20px 16px 28px;\">" + escapeHtml(code) + "</span></div>"
                + "<p style=\"margin:0;color:#6b7280;font-size:13px;\">" + escapeHtml(footerText) + "</p>";
    }

    // ---- Delivery ----

    private void sendHtml(String to, String subject, String bodyHtml) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            // multipart=true is required for addInline() below — without it the logo cannot be attached.
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(wrapInTemplate(bodyHtml), true);
            attachLogo(helper);
            mailSender.send(message);
        } catch (MailException | MessagingException e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    /**
     * The logo travels with the message as an inline CID part rather than a hotlinked URL, so it renders
     * in clients that block remote images and works even though the backend isn't publicly reachable.
     * A missing asset degrades to the alt text instead of failing the send.
     */
    private void attachLogo(MimeMessageHelper helper) {
        try {
            ClassPathResource logo = new ClassPathResource(LOGO_RESOURCE);
            if (logo.exists()) {
                helper.addInline(LOGO_CID, logo, "image/png");
            }
        } catch (MessagingException e) {
            log.warn("Could not attach the CaseFlow logo to an outgoing email: {}", e.getMessage());
        }
    }

    private String wrapInTemplate(String bodyHtml) {
        return "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:" + CREAM + ";"
                + "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:" + CREAM + ";padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;\">"
                // Header: logo left, wordmark right.
                + "<tr><td style=\"background:" + NAVY + ";padding:20px 32px;\">"
                + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr>"
                + "<td style=\"padding-right:12px;\">"
                + "<img src=\"cid:" + LOGO_CID + "\" width=\"40\" height=\"40\" alt=\"AUCA\" "
                + "style=\"display:block;width:40px;height:40px;border-radius:50%;background:#ffffff;\">"
                + "</td><td>"
                + "<span style=\"color:#ffffff;font-size:18px;font-weight:700;\">CaseFlow</span><br>"
                + "<span style=\"color:" + ACCENT + ";font-size:11px;letter-spacing:1px;text-transform:uppercase;\">"
                + "AUCA Disciplinary Platform</span>"
                + "</td></tr></table>"
                + "</td></tr>"
                + "<tr><td style=\"padding:32px;color:#1f2937;font-size:14px;line-height:1.6;\">" + bodyHtml + "</td></tr>"
                // Sign-off.
                + "<tr><td style=\"padding:0 32px 24px;color:#4b5563;font-size:13px;\">"
                + "&mdash; AUCA Disciplinary Committee</td></tr>"
                + "<tr><td style=\"padding:20px 32px;border-top:1px solid #eee;color:#9ca3af;font-size:11px;\">"
                + "CaseFlow &middot; Adventist University of Central Africa, Rwanda. "
                + "This is an automated message — please don't reply."
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    private static String escapeHtml(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttribute(String s) {
        return escapeHtml(s).replace("\"", "&quot;");
    }
}
