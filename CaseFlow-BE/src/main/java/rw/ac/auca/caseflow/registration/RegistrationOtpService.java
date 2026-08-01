package rw.ac.auca.caseflow.registration;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import rw.ac.auca.caseflow.email.EmailService;

// In-memory by design: codes are short-lived and freely re-requestable, so losing
// pending codes on a backend restart is a non-issue (unlike JwtService's signing key).
@Service
public class RegistrationOtpService {

    private static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    private final EmailService emailService;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Entry> pending = new ConcurrentHashMap<>();

    public RegistrationOtpService(EmailService emailService) {
        this.emailService = emailService;
    }

    public void sendCode(String email) {
        String key = email.toLowerCase();
        Entry existing = pending.get(key);
        if (existing != null && existing.sentAt.plus(RESEND_COOLDOWN).isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait before requesting another code.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        pending.put(key, new Entry(code, Instant.now().plus(CODE_TTL), Instant.now()));
        emailService.sendOtpCode(email, code);
    }

    public void verifyCode(String email, String code) {
        String key = email.toLowerCase();
        Entry entry = pending.get(key);
        if (entry == null || entry.expiresAt.isBefore(Instant.now())) {
            pending.remove(key);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That code has expired. Please request a new one.");
        }
        if (entry.attempts >= MAX_ATTEMPTS) {
            pending.remove(key);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Too many incorrect attempts. Please request a new code.");
        }
        if (!entry.code.equals(code)) {
            entry.attempts++;
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect code.");
        }
    }

    public void consume(String email) {
        pending.remove(email.toLowerCase());
    }

    private static final class Entry {
        final String code;
        final Instant expiresAt;
        final Instant sentAt;
        int attempts;

        Entry(String code, Instant expiresAt, Instant sentAt) {
            this.code = code;
            this.expiresAt = expiresAt;
            this.sentAt = sentAt;
        }
    }
}
