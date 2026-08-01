package rw.ac.auca.caseflow.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;

/**
 * Signs and parses the HMAC-SHA256 bearer tokens used for all authenticated requests. Tokens are
 * self-contained (id/email/role/studentId claims) so {@link JwtAuthenticationFilter} never needs a
 * database round-trip to authenticate a request.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long normalTtlMinutes;
    private final long rememberTtlMinutes;

    public JwtService(
            @Value("${caseflow.jwt.secret}") String secret,
            @Value("${caseflow.jwt.expiration-minutes}") long normalTtlMinutes,
            @Value("${caseflow.jwt.remember-expiration-minutes}") long rememberTtlMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.normalTtlMinutes = normalTtlMinutes;
        this.rememberTtlMinutes = rememberTtlMinutes;
    }

    public String generateToken(AppUser user, boolean remember) {
        Instant now = Instant.now();
        long ttlMinutes = remember ? rememberTtlMinutes : normalTtlMinutes;
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().wireValue())
                .claim("name", user.getName())
                .claim("studentId", user.getStudentId())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttlMinutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    /** Returns null if the token is missing, malformed, expired, or otherwise invalid. */
    public AuthenticatedUser parseToken(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Long id = Long.parseLong(claims.getSubject());
            Role role = Role.fromWireValue(claims.get("role", String.class));
            return new AuthenticatedUser(id, claims.get("email", String.class), role, claims.get("studentId", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
