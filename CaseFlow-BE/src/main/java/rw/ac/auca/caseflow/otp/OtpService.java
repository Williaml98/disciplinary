package rw.ac.auca.caseflow.otp;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

// In-memory by design: codes are short-lived and freely re-requestable, so losing
// pending codes on a backend restart is a non-issue (unlike JwtService's signing key).
// Keyed by purpose+email so, e.g., a registration code and a password-reset code for
// the same address never collide.
@Service
public class OtpService {

    private static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Entry> pending = new ConcurrentHashMap<>();

    public OtpService() {
        this(Clock.systemUTC());
    }

    // Package-private: lets tests inject a controllable clock instead of waiting out
    // the real 10-minute expiry / 60-second cooldown. Spring always uses the no-arg
    // constructor above since it's the only public one.
    OtpService(Clock clock) {
        this.clock = clock;
    }

    // emailSender is invoked with the generated code so each caller can send its own copy.
    public void sendCode(String purpose, String email, Consumer<String> emailSender) {
        String key = key(purpose, email);
        Entry existing = pending.get(key);
        if (existing != null && existing.sentAt.plus(RESEND_COOLDOWN).isAfter(clock.instant())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait before requesting another code.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        pending.put(key, new Entry(code, clock.instant().plus(CODE_TTL), clock.instant()));
        emailSender.accept(code);
    }

    public void verifyCode(String purpose, String email, String code) {
        String key = key(purpose, email);
        Entry entry = pending.get(key);
        if (entry == null || entry.expiresAt.isBefore(clock.instant())) {
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

    public void consume(String purpose, String email) {
        pending.remove(key(purpose, email));
    }

    private static String key(String purpose, String email) {
        return purpose + ":" + email.toLowerCase();
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
