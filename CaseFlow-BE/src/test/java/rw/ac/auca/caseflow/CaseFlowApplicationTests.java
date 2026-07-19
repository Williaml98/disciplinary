package rw.ac.auca.caseflow;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import rw.ac.auca.caseflow.repository.CaseRepository;
import rw.ac.auca.caseflow.repository.UserRepository;

@SpringBootTest
class CaseFlowApplicationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CaseRepository caseRepository;

    @Test
    void contextLoadsAndSeedsDemoData() {
        assertThat(userRepository.count()).isEqualTo(4);
        assertThat(caseRepository.count()).isEqualTo(6);
    }
}
