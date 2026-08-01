package rw.ac.auca.caseflow.security;

import static org.assertj.core.api.Assertions.assertThat;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

class JwtServiceTest {

    private static final String SECRET = "unit-test-signing-secret-at-least-256-bits-long-for-hs512!!";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, 720, 43200);
    }

    private AppUser user(Role role) {
        AppUser user = new AppUser("Jean Bosco", role, null, "21045", "jean@auca.ac.rw", "hash");
        setId(user, 42L);
        return user;
    }

    private static void setId(AppUser user, Long id) {
        try {
            var field = AppUser.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void generatedTokenParsesBackToTheSameClaims() {
        String token = jwtService.generateToken(user(Role.STUDENT), false);

        AuthenticatedUser parsed = jwtService.parseToken(token);

        assertThat(parsed).isNotNull();
        assertThat(parsed.id()).isEqualTo(42L);
        assertThat(parsed.email()).isEqualTo("jean@auca.ac.rw");
        assertThat(parsed.role()).isEqualTo(Role.STUDENT);
        assertThat(parsed.studentId()).isEqualTo("21045");
    }

    @Test
    void rememberMeProducesALongerLivedTokenThanNormalLogin() {
        String normalToken = jwtService.generateToken(user(Role.LECTURER), false);
        String rememberToken = jwtService.generateToken(user(Role.LECTURER), true);

        long normalExp = parseExpiry(normalToken);
        long rememberExp = parseExpiry(rememberToken);

        assertThat(rememberExp).isGreaterThan(normalExp);
    }

    @Test
    void parseTokenReturnsNullForGarbageInput() {
        assertThat(jwtService.parseToken("not-a-real-token")).isNull();
    }

    @Test
    void parseTokenReturnsNullForATokenSignedWithADifferentSecret() {
        SecretKey otherKey = Keys.hmacShaKeyFor("a-completely-different-signing-secret-256-bits!!".getBytes(StandardCharsets.UTF_8));
        String foreignToken = Jwts.builder()
                .subject("1")
                .claim("email", "x@auca.ac.rw")
                .claim("role", "student")
                .expiration(Date.from(Instant.now().plus(1, ChronoUnit.HOURS)))
                .signWith(otherKey)
                .compact();

        assertThat(jwtService.parseToken(foreignToken)).isNull();
    }

    @Test
    void parseTokenReturnsNullForAnExpiredToken() {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String expiredToken = Jwts.builder()
                .subject("1")
                .claim("email", "x@auca.ac.rw")
                .claim("role", "student")
                .issuedAt(Date.from(Instant.now().minus(2, ChronoUnit.HOURS)))
                .expiration(Date.from(Instant.now().minus(1, ChronoUnit.HOURS)))
                .signWith(key)
                .compact();

        assertThat(jwtService.parseToken(expiredToken)).isNull();
    }

    private long parseExpiry(String token) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token)
                .getPayload().getExpiration().getTime();
    }
}
