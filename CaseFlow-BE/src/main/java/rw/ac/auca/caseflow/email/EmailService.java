package rw.ac.auca.caseflow.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Arrays;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String NAVY = "#1D3A5F";
    private static final String ACCENT = "#9CC7EE";

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(JavaMailSender mailSender, @Value("${caseflow.mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    // Plain-text call sites (case decision/appeal/reintegration notices) stay untouched —
    // blank-line-separated paragraphs are rendered into the same branded shell as sendOtpCode.
    public void send(String to, String subject, String body) {
        String bodyHtml = Arrays.stream(body.strip().split("\n\n"))
                .map(paragraph -> "<p style=\"margin:0 0 16px;\">" + escapeHtml(paragraph.strip()).replace("\n", "<br>") + "</p>")
                .collect(Collectors.joining());
        sendHtml(to, subject, bodyHtml);
    }

    public void sendOtpCode(String to, String code) {
        String bodyHtml = otpEmailBody(
                "Use the code below to verify your email and finish creating your CaseFlow account.", code,
                "This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.");
        sendHtml(to, "Your CaseFlow verification code", bodyHtml);
    }

    public void sendPasswordResetCode(String to, String code) {
        String bodyHtml = otpEmailBody(
                "Use the code below to reset your CaseFlow password.", code,
                "This code expires in 10 minutes. If you didn't request a password reset, "
                        + "you can safely ignore this email — your password will stay unchanged.");
        sendHtml(to, "Reset your CaseFlow password", bodyHtml);
    }

    private String otpEmailBody(String introText, String code, String footerText) {
        return "<p style=\"margin:0 0 20px;\">" + introText + "</p>"
                + "<div style=\"text-align:center;margin:0 0 20px;\">"
                + "<span style=\"display:inline-block;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:32px;font-weight:700;"
                + "letter-spacing:8px;color:" + NAVY + ";background:#f0ead9;border:1px solid #e0d6bb;"
                + "border-radius:12px;padding:16px 20px 16px 28px;\">" + escapeHtml(code) + "</span></div>"
                + "<p style=\"margin:0;color:#6b7280;font-size:13px;\">" + footerText + "</p>";
    }

    private void sendHtml(String to, String subject, String bodyHtml) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(wrapInTemplate(bodyHtml), true);
            mailSender.send(message);
        } catch (MailException | MessagingException e) {
            log.warn("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private String wrapInTemplate(String bodyHtml) {
        return "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background:#f0ead9;"
                + "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f0ead9;padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" "
                + "style=\"background:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;\">"
                + "<tr><td style=\"background:" + NAVY + ";padding:24px 32px;\">"
                + "<span style=\"color:#ffffff;font-size:18px;font-weight:700;\">CaseFlow</span><br>"
                + "<span style=\"color:" + ACCENT + ";font-size:11px;letter-spacing:1px;text-transform:uppercase;\">"
                + "AUCA Disciplinary Platform</span>"
                + "</td></tr>"
                + "<tr><td style=\"padding:32px;color:#1f2937;font-size:14px;line-height:1.6;\">" + bodyHtml + "</td></tr>"
                + "<tr><td style=\"padding:20px 32px;border-top:1px solid #eee;color:#9ca3af;font-size:11px;\">"
                + "© 2026 CaseFlow &middot; Adventist University of Central Africa, Rwanda. This is an automated message — please don't reply."
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
