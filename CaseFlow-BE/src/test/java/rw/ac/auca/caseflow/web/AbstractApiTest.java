package rw.ac.auca.caseflow.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.caseflow.domain.AppUser;
import rw.ac.auca.caseflow.domain.Role;
import rw.ac.auca.caseflow.repository.UserRepository;
import rw.ac.auca.caseflow.security.JwtService;

// @Transactional rolls back every test's DB changes, so each test method starts from a clean
// slate (in particular: userRepository.count() == 0 unless the test itself creates a user).
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
abstract class AbstractApiTest {

    protected static final String DEFAULT_PASSWORD = "Password123!";

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected UserRepository userRepository;
    @Autowired protected PasswordEncoder passwordEncoder;
    @Autowired protected JwtService jwtService;

    protected AppUser createUser(String name, String email, Role role, String studentId) {
        AppUser user = new AppUser(name, role, null, studentId, email, passwordEncoder.encode(DEFAULT_PASSWORD));
        return userRepository.save(user);
    }

    protected String tokenFor(AppUser user) {
        return jwtService.generateToken(user, false);
    }
}
