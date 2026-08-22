package rw.ac.auca.caseflow.service;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * Generates the one-time password emailed to an account an admin creates.
 *
 * <p>The admin never chooses it and never sees it — the account is flagged {@code mustChangePassword},
 * so the temporary value is only good for the single sign-in during which the user replaces it.
 */
@Component
public class TemporaryPasswordGenerator {

    // Excludes characters that are easily confused when read off an email: 0/O, 1/l/I.
    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijkmnopqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String SYMBOLS = "@#$%*?";
    private static final String ALL = UPPER + LOWER + DIGITS + SYMBOLS;

    private static final int LENGTH = 12;

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder password = new StringBuilder(LENGTH);
        // Seed one of each class first so the result always satisfies a mixed-character policy.
        password.append(pick(UPPER)).append(pick(LOWER)).append(pick(DIGITS)).append(pick(SYMBOLS));
        while (password.length() < LENGTH) {
            password.append(pick(ALL));
        }
        return shuffle(password);
    }

    private char pick(String alphabet) {
        return alphabet.charAt(random.nextInt(alphabet.length()));
    }

    /** Fisher-Yates, so the guaranteed characters aren't always in the first four positions. */
    private String shuffle(StringBuilder password) {
        for (int i = password.length() - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = password.charAt(i);
            password.setCharAt(i, password.charAt(j));
            password.setCharAt(j, tmp);
        }
        return password.toString();
    }
}
