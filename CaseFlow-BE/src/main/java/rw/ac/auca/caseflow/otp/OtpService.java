package rw.ac.auca.caseflow.otp;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
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

    // The 60-second cooldown alone only paces requests — it does not bound them, so an address could be
    // mailed a code every minute indefinitely. These cap the total over a longer window, which is what
    // stops someone's inbox being used as a mailbomb target (and our SMTP reputation with it).
    private static final Duration SEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_SENDS_PER_WINDOW = 5;

    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Entry> pending = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Deque<Instant>> sendHistory = new ConcurrentHashMap<>();

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
        Instant now = clock.instant();

        Entry existing = pending.get(key);
        if (existing != null && existing.sentAt.plus(RESEND_COOLDOWN).isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait before requesting another code.");
        }
        requireSendQuota(key, now);

        String code = String.format("%06d", random.nextInt(1_000_000));
        pending.put(key, new Entry(code, now.plus(CODE_TTL), now));
        emailSender.accept(code);
    }

    /**
     * Sliding window over the last {@link #SEND_WINDOW}. Synchronized on the per-key deque because
     * read-modify-write across a check and an append is not atomic on its own.
     */
    private void requireSendQuota(String key, Instant now) {
        Deque<Instant> history = sendHistory.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (history) {
            Instant cutoff = now.minus(SEND_WINDOW);
            while (!history.isEmpty() && history.peekFirst().isBefore(cutoff)) {
                history.pollFirst();
            }
            if (history.size() >= MAX_SENDS_PER_WINDOW) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many codes requested for this address. Please try again later.");
            }
            history.addLast(now);
        }
        purgeExpired(now);
    }

    /**
     * Both maps are keyed by caller-supplied email, so without eviction they grow without bound under
     * abuse — entries are only otherwise removed when someone verifies or consumes that exact key.
     */
    private void purgeExpired(Instant now) {
        Instant cutoff = now.minus(SEND_WINDOW);
        pending.entrySet().removeIf(e -> e.getValue().expiresAt.isBefore(now));
        for (Iterator<Map.Entry<String, Deque<Instant>>> it = sendHistory.entrySet().iterator(); it.hasNext(); ) {
            Deque<Instant> history = it.next().getValue();
            synchronized (history) {
                while (!history.isEmpty() && history.peekFirst().isBefore(cutoff)) {
                    history.pollFirst();
                }
                if (history.isEmpty()) {
                    it.remove();
                }
            }
        }
    }

    public void verifyCode(String purpose, String email, String code) {
        String key = key(purpose, email);
        Entry entry = pending.get(key);
        if (entry == null || entry.expiresAt.isBefore(clock.instant())) {
            pending.remove(key);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That code has expired. Please request a new one.");
        }
        synchronized (entry) {
            if (entry.attempts >= MAX_ATTEMPTS) {
                pending.remove(key);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Too many incorrect attempts. Please request a new code.");
            }
            if (!entry.code.equals(code)) {
                // Synchronized because concurrent guesses would otherwise lose increments against this
                // plain int, letting an attacker exceed the attempt cap.
                entry.attempts++;
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incorrect code.");
            }
        }
    }

    public void consume(String purpose, String email) {
        pending.remove(key(purpose, email));
    }

    private static String key(String purpose, String email) {
        return purpose + ":" + email.toLowerCase(java.util.Locale.ROOT);
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
