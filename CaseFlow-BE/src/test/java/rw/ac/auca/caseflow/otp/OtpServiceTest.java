package rw.ac.auca.caseflow.otp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class OtpServiceTest {

    private MutableClock clock;
    private OtpService otpService;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        otpService = new OtpService(clock);
    }

    @Test
    void correctCodeVerifiesSuccessfully() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> sentCode[0] = code);

        assertThat(sentCode[0]).matches("\\d{6}");
        otpService.verifyCode("register", "a@auca.ac.rw", sentCode[0]);
    }

    @Test
    void wrongCodeIsRejected() {
        otpService.sendCode("register", "a@auca.ac.rw", code -> { });

        assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", "000000"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void verifyingWithNoPriorSendIsRejectedAsExpired() {
        assertThatThrownBy(() -> otpService.verifyCode("register", "nobody@auca.ac.rw", "123456"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void fifthWrongAttemptLocksOutFurtherVerification() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> sentCode[0] = code);

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", "000000"))
                    .isInstanceOf(ResponseStatusException.class);
        }

        // Even the correct code is now rejected — the entry was invalidated after the 5th attempt.
        assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", sentCode[0]))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void codeExpiresAfterTenMinutes() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> sentCode[0] = code);

        clock.advance(Duration.ofMinutes(10).plusSeconds(1));

        assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", sentCode[0]))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getReason()).contains("expired"));
    }

    @Test
    void codeStillValidJustBeforeExpiry() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> sentCode[0] = code);

        clock.advance(Duration.ofMinutes(9).plusSeconds(59));

        otpService.verifyCode("register", "a@auca.ac.rw", sentCode[0]);
    }

    @Test
    void resendWithinCooldownIsRejected() {
        otpService.sendCode("register", "a@auca.ac.rw", code -> { });

        clock.advance(Duration.ofSeconds(59));

        assertThatThrownBy(() -> otpService.sendCode("register", "a@auca.ac.rw", code -> { }))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(429));
    }

    @Test
    void resendAfterCooldownSucceedsWithNewCode() {
        String[] firstCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> firstCode[0] = code);

        clock.advance(Duration.ofSeconds(61));

        String[] secondCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> secondCode[0] = code);

        // The old code is no longer valid — resending replaces the pending entry.
        assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", firstCode[0]))
                .isInstanceOf(ResponseStatusException.class);
        otpService.verifyCode("register", "a@auca.ac.rw", secondCode[0]);
    }

    @Test
    void consumeInvalidatesTheCode() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> sentCode[0] = code);
        otpService.consume("register", "a@auca.ac.rw");

        assertThatThrownBy(() -> otpService.verifyCode("register", "a@auca.ac.rw", sentCode[0]))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void differentPurposesForSameEmailDoNotCollide() {
        String[] registerCode = new String[1];
        String[] resetCode = new String[1];
        otpService.sendCode("register", "a@auca.ac.rw", code -> registerCode[0] = code);
        otpService.sendCode("reset-password", "a@auca.ac.rw", code -> resetCode[0] = code);

        assertThatThrownBy(() -> otpService.verifyCode("reset-password", "a@auca.ac.rw", registerCode[0]))
                .isInstanceOf(ResponseStatusException.class);
        otpService.verifyCode("register", "a@auca.ac.rw", registerCode[0]);
        otpService.verifyCode("reset-password", "a@auca.ac.rw", resetCode[0]);
    }

    @Test
    void emailIsMatchedCaseInsensitively() {
        String[] sentCode = new String[1];
        otpService.sendCode("register", "Person@AUCA.ac.rw", code -> sentCode[0] = code);

        otpService.verifyCode("register", "person@auca.ac.rw", sentCode[0]);
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public Instant instant() {
            return instant;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            throw new UnsupportedOperationException();
        }
    }
}
