package rw.ac.auca.caseflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// UserDetailsServiceAutoConfiguration excluded: auth is handled entirely by JwtAuthenticationFilter
// populating the SecurityContext directly, so Spring's default in-memory user/password is never used.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class CaseFlowApplication {

    public static void main(String[] args) {
        SpringApplication.run(CaseFlowApplication.class, args);
    }
}
